# SyncCodes

[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square)](https://nodejs.org)
[![Socket.IO](https://img.shields.io/badge/socket.io-4.x-010101?style=flat-square)](https://socket.io)
[![Prisma](https://img.shields.io/badge/prisma-5.x-2D3748?style=flat-square)](https://prisma.io)
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red?style=flat-square)](./LICENSE.txt)
[![Status](https://img.shields.io/badge/status-production-success?style=flat-square)](https://www.synccode.in)

A real-time collaborative engineering workspace. Multiple engineers share a session room that combines a live code editor with conflict-free synchronization, WebRTC video conferencing, a collaborative whiteboard, end-to-end encrypted private chat, sandboxed multi-language code execution, and AI-generated interview questions — all within a single persistent session.

**Production**: [synccode.in](https://www.synccode.in)

---

## Problem Statement



Distributed teams operating across different time zones rely on a patchwork of tools: a shared editor in one tab, a video call in another, a whiteboard in a third. Context switching erodes focus, and no single tool provides the full surface area an engineering session requires. SyncCodes eliminates that fragmentation by co-locating every collaboration primitive — editing, communication, execution, and review — inside one stateful, real-time room.

---

## Architecture

```mermaid
graph TD
    subgraph Client ["Client (React 18)"]
        CM["CodeMirror 5\ny-codemirror binding"]
        YJS["Yjs Document\n(in-memory CRDT)"]
        WB["Konva.js Canvas\n(Whiteboard)"]
        RTC["RTCPeerConnection\n(Video/Screen)"]
        SIO_C["socket.io-client"]
        SUPA["Supabase JS SDK\n(Auth)"]
    end

    subgraph Backend ["Backend (Node 18 / Express 4)"]
        SIO_S["Socket.IO Server 4.x"]
        REST["REST API\n/api/auth /api/rooms\n/api/execute /api/questions"]
        GUARDS["Socket Guards\nSliding-window rate limit\nAuth + room membership"]
        EXEC["Execution Router\nlocal | piston | disabled"]
        GEMINI["Gemini Service\nPDF+DOCX parsing\nQuestion generation"]
    end

    subgraph Infra ["Infrastructure"]
        REDIS["Redis 7\n@socket.io/redis-adapter\nPub/Sub fan-out"]
        PISTON["Piston\nSandboxed containers\nper-run isolation"]
        PG["PostgreSQL\nPrisma 5 ORM\n(Neon serverless)"]
        SUPA_AUTH["Supabase Auth\nOAuth + OTP\nJWKS endpoint"]
        NGINX["Nginx 1.27\nTLS termination\nWebSocket upgrade"]
    end

    CM --> YJS
    YJS -->|yjs:update binary| SIO_C
    WB -->|stroke delta| SIO_C
    RTC -->|SDP + ICE candidates| SIO_C
    SUPA -->|access_token in handshake| SIO_C

    SIO_C -->|WSS| NGINX
    NGINX -->|proxy_pass| SIO_S
    NGINX -->|proxy_pass| REST

    SIO_S --> GUARDS
    GUARDS --> SIO_S
    SIO_S <-->|pub/sub| REDIS

    REST --> EXEC
    REST --> GEMINI
    REST --> PG
    SIO_S --> PG

    EXEC -->|POST /api/v2/execute| PISTON
    SUPA_AUTH -->|JWKS RS256 verify| SIO_S
```

### Request lifecycle summary

| Path | Protocol | Auth | Notes |
|---|---|---|---|
| `/api/*` | HTTPS | Bearer JWT (Supabase RS256) | Rate-limited, Helmet headers |
| `/socket.io/` | WSS (upgraded by Nginx) | Token in handshake | JWKS-verified before `connect` |
| WebRTC media | DTLS-SRTP P2P | None (post-ICE) | Never touches server |
| Piston | HTTP (internal Docker network) | Server-side only | Not reachable from internet |

---

## Feature Implementation

### Collaborative Editor — Yjs CRDT

The editor is CodeMirror 5 bound to a shared Yjs `Y.Text` via `y-codemirror`. Every keystroke produces a binary update (a compact Merkle-clock delta, not a diff). The event flow:

```
User types
  → Yjs encodes update (Uint8Array)
  → socket.emit('yjs:update', { roomId, update })
  → Server broadcasts to room (socket.to(roomId).emit)
  → Remote peers apply update via Y.applyUpdate()
  → CodeMirror reflects change
```

Late joiners trigger a `yjs:sync-request`. Any peer in the room responds with `yjs:sync-response` containing a full `Y.encodeStateAsUpdate()` snapshot. The server never holds document state — it relays binaries blindly. Convergence is guaranteed by CRDT semantics regardless of message reorder or duplicate delivery.

Socket guards enforce payload size bounds (configurable via env, defaulting to 256 KB per update, 512 KB for sync snapshots) and a sliding-window rate limit of 200 updates per 10-second window per socket.

### WebRTC Video Conferencing

Signaling uses Socket.IO as the transport. The sequence on room join:

```
Joiner emits room:join
  → Server responds with peer list (socketIds + userId)
  → Joiner sends user:call { to, offer } to each existing peer
  → Peer responds call:accepted { ans }
  → Both sides exchange ICE candidates via webrtc-ice-candidate (trickle)
  → DTLS-SRTP media flows directly peer-to-peer
```

Every signaling event (`user:call`, `call:accepted`, `peer:nego:needed`, `webrtc-ice-candidate`) is guarded by `shareARoom()` — which verifies that sender and target share at least one Socket.IO room in the adapter. Cross-session signal injection is structurally impossible regardless of socket ID knowledge.

Screen sharing uses `getDisplayMedia()` on an existing `RTCPeerConnection` via renegotiation (`peer:nego:needed` / `peer:nego:done`).

### Room Admission (Waiting Lobby)

Non-owner joiners are placed in a synthetic `waiting:<roomId>` Socket.IO room. They can observe lobby chat but have no access to the live session room, the Yjs document, or WebRTC signaling until the owner emits `room:admit`. On admission, the socket leaves the waiting room, joins the canonical room, and receives the current participant list for WebRTC handshake initiation. This is enforced at the guard layer — `canSendPrivateChat` and `assertSocketInRoom` both check `socket.data.joinedRooms`, which is populated only after admission.

### Code Execution Pipeline

The execution backend is selected at startup via `EXECUTION_BACKEND` (env var). Three modes:

| Mode | Use case |
|---|---|
| `piston` | Production. Forwards to self-hosted Piston over the Docker-internal network. |
| `local` | Development only. Blocked at startup in `NODE_ENV=production` by env validation. |
| `disabled` | Safe fallback. Returns a 503 with a clear message. |

Piston runs each submission in an ephemeral container with no network access, hard memory and wall-clock limits, and filesystem isolation. The backend proxies the result and broadcasts it over Socket.IO so all session participants see identical output. Source size is capped server-side (default 100 KB) before the Piston request is made.

### End-to-End Encrypted Chat

Private messages use a hybrid encryption scheme:

1. Each client generates an ECDH P-256 key pair in the browser on first login.
2. The public key is registered via `POST /api/users/me/public-key` and stored in `User.publicKey`.
3. When sending a private message, the sender performs ECDH with each recipient's public key to derive a per-recipient shared secret, wraps an AES-GCM key, and sends `{ content, iv, recipientKeys, encrypted: true }`.
4. The server persists the ciphertext and broadcasts it. It never has access to the plaintext.

Public-room chat is stored and broadcast in plaintext; only messages with `encrypted: true` use the hybrid scheme.

### AI Interview Question Generation

Resume files (PDF or DOCX) are parsed in-process using `pdf-parse` and `mammoth`. Extracted text is sent to the Gemini API with a structured prompt specifying difficulty (1–5) and topic focus (Skills, Projects, Experience, etc.). Questions are streamed back and returned as a JSON array. The endpoint is rate-limited via `express-rate-limit` and requires authentication.

---

## Data Model

```prisma
model User {
  id             String  @id @default(cuid())
  supabaseUserId String? @unique  // Supabase auth.users.id (JWT sub)
  email          String  @unique
  name           String
  publicKey      String? // ECDH P-256 public key for E2E chat
  ...
}

model Room {
  id       String @id @default(cuid())
  joinCode String @unique  // 6-char nanoid, case-insensitive join
  ownerId  String
  language String @default("javascript")
  isActive Boolean @default(true)
}

model SessionMember {
  userId     String
  roomId     String
  admittedAt DateTime? // null = still in waiting lobby
  @@unique([userId, roomId])
  @@index([roomId, leftAt])
}

model Message {
  content      String
  iv           String?  // AES-GCM IV (base64), null for plaintext
  recipientKeys Json?   // Map<userId, wrappedKey> for E2E messages
  encrypted    Boolean @default(false)
  scope        String  @default("ROOM")  // ROOM | PRIVATE
  threadId     String? // References ChatThread for group DMs
  @@index([roomId, scope, createdAt(sort: Desc)])
  @@index([threadId, createdAt(sort: Desc)])
}
```

Chat history queries are served by composite indexes on `(roomId, scope, createdAt DESC)` and `(threadId, createdAt DESC)`. Both support efficient cursor-based pagination.

---

## Socket Event Reference

| Event | Direction | Description |
|---|---|---|
| `room:join` | C→S | Join or create a room by ID or join code |
| `room:joined` | S→C | Admission confirmed; includes peer list for WebRTC |
| `room:waiting` | S→C | Placed in lobby; awaiting host admission |
| `room:admit` | C→S | Host admits a waiting socket |
| `yjs:update` | C→S→C | Binary CRDT delta, relayed to room |
| `yjs:sync-request` | C→S→C | Late-joiner requests document state |
| `yjs:sync-response` | C→S→C | Peer sends full Y.encodeStateAsUpdate snapshot |
| `code:change` | C→S→C | Legacy plaintext snapshot (non-Yjs fallback) |
| `user:call` | C→S→C | WebRTC offer to specific peer |
| `call:accepted` | C→S→C | WebRTC answer |
| `webrtc-ice-candidate` | C→S→C | Trickle ICE candidate |
| `peer:nego:needed` | C→S→C | Renegotiation offer (screen share) |
| `whiteboard:draw` | C→S→C | Stroke delta to room |
| `whiteboard:clear` | C→S→C | Canvas clear broadcast |
| `message:send` | C→S | Persist + broadcast chat message |
| `message:received` | S→C | Broadcast to room or thread members |

---

## Security

- **Authentication**: Supabase RS256 JWTs verified against the JWKS endpoint on every socket connection. `SOCKET_AUTH_REQUIRED=true` in production blocks unauthenticated sockets from any room action.
- **Room isolation**: `assertSocketInRoom` resolves both the internal UUID and the human-readable join code to the canonical room ID and checks `socket.data.joinedRooms` (a `Set` populated only after server-side admission). Cross-room signal injection is structurally blocked.
- **Rate limiting**: REST API: 200 requests / 15 min per IP (`express-rate-limit`). Socket: sliding-window limiter per socket ID — 200 Yjs updates / 10 s, 30 room joins / 60 s. Limits are tunable via env vars.
- **Payload validation**: Yjs updates capped at 256 KB, sync snapshots at 512 KB, source code at 100 KB. All caps configurable.
- **HTTP security**: `helmet` with Content-Security-Policy disabled (frontend on separate origin). `trust proxy: 1` ensures rate limiting keys on real client IP behind Nginx.
- **Piston isolation**: Code execution runs with no outbound network, ephemeral filesystem, and hard resource caps. The Piston API endpoint is on a Docker-internal network with no external exposure.

---

## Tech Stack

**Frontend**

| Library | Role |
|---|---|
| React 18, React Router 6 | UI and routing |
| CodeMirror 5 + `y-codemirror` | Code editor with Yjs binding |
| Konva.js + react-konva | Whiteboard canvas |
| socket.io-client 4.x | Real-time transport |
| Supabase JS SDK | Auth (OAuth, OTP) |
| Tailwind CSS, MUI 6 | Styling |
| Zod | Client-side schema validation |

**Backend**

| Library | Role |
|---|---|
| Express 4 | HTTP server |
| Socket.IO 4 | WebSocket server |
| `@socket.io/redis-adapter` | Cross-instance pub/sub |
| Prisma 5 | ORM + migrations |
| `redis` 4.x | Redis client (two connections for adapter) |
| `jwks-rsa` | JWKS key fetching + caching |
| `jsonwebtoken` | JWT verification |
| `@google/generative-ai` | Gemini API client |
| `multer`, `pdf-parse`, `mammoth` | File upload and parsing |
| `helmet`, `express-rate-limit` | Security hardening |
| `winston` | Structured logging |
| Zod | Request body validation |

**Infrastructure**

| Component | Technology |
|---|---|
| Backend host | EC2 (Docker Compose) |
| Frontend host | Vercel |
| Database | Neon (serverless PostgreSQL) |
| Auth | Supabase (Auth only) |
| Reverse proxy | Nginx 1.27 (TLS 1.2/1.3, Let's Encrypt) |
| In-memory pub/sub | Redis 7 (Alpine, 256 MB LRU cap) |
| Code execution | Piston (self-hosted, Docker) |

---

## Local Development

### Prerequisites

- Node 18+
- Docker + Docker Compose
- Supabase project (for Auth)
- Neon or local PostgreSQL instance

### 1. Start Redis and Piston

```bash
docker compose -f docker-compose.execution.yml up -d
```

Redis is available at `localhost:6379`. Piston's HTTP API is available at `localhost:2000`.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

**`backend/.env`**

```env
NODE_ENV=development
PORT=8000

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/synccodes
DIRECT_URL=postgresql://user:password@localhost:5432/synccodes

# Redis (Socket.IO adapter — omit to run single-instance without Redis)
REDIS_URL=redis://localhost:6379

# Code execution
EXECUTION_BACKEND=piston
PISTON_API_URL=http://localhost:2000

# Supabase Auth
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_SECRET=<jwt-secret-from-supabase-dashboard>

# AI
GEMINI_API_KEY=<your-gemini-api-key>

# Misc
JWT_SECRET=<random-hex-string>
ALLOWED_ORIGINS=http://localhost:3000
SOCKET_AUTH_REQUIRED=false
```

### 3. Frontend

```bash
cd client
cp .env.example .env
npm install
npm start
```

**`client/.env`**

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<supabase-anon-key>
```

---

## Production Deployment

The production stack runs as a Docker Compose service set on EC2. The frontend is deployed independently to Vercel and communicates with the EC2 origin over HTTPS.

```bash
# On the EC2 host
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

Services: `redis`, `piston`, `backend`, `nginx`. Nginx handles SSL termination via Let's Encrypt certificates mounted as a read-only volume and proxies `/api/*` and `/socket.io/*` to the backend container on port 8000. WebSocket upgrade headers (`Upgrade`, `Connection`) and a 600-second `proxy_read_timeout` are set on the `/socket.io/` location block to prevent premature connection drops.

Database migrations are run once at deploy time:

```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Environment-specific guards

`EXECUTION_BACKEND=local` is blocked at server startup when `NODE_ENV=production` — the env validation layer throws before Express initializes. `localExecutor.js` has a second `require`-time guard for the same reason.

---

## Scalability

### Current bottlenecks

| Layer | Bottleneck | Mitigation in place |
|---|---|---|
| Socket.IO | Single process, single event loop | Redis adapter already wired — add replicas behind an LB |
| PostgreSQL | Connection pool exhaustion under load | Prisma connection pool; PgBouncer is the next step |
| Piston | CPU-bound container spawning | Move to a dedicated host or fleet; backend is already a thin proxy |
| File uploads | In-process `multer` memory storage | Suitable for resume-sized files; swap to S3 presigned upload for larger workloads |
| Gemini API | External rate limits, latency tail | Request queue with exponential backoff; responses are not cached today |

### Horizontal scaling Socket.IO

The Redis adapter is registered conditionally:

```js
if (env.redisUrl) {
  const pubClient = createClient({ url: env.redisUrl });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
}
```

Two separate Redis connections are required — one for pub, one for sub — because the Redis protocol does not allow a subscribed client to issue commands. With the adapter active, `io.to(roomId).emit(...)` fans out across all Node instances transparently. The only stateful concern is the `emailToSocketIdMap` / `socketidToEmailMap` in-process Maps: in a multi-instance setup these must move to Redis hashes. That refactor is the only application-layer change needed.

### Database indexing strategy

Composite indexes are designed around the two dominant query shapes:

- **Paginated room chat**: `(roomId, scope, createdAt DESC)` — covers the common `WHERE roomId = ? AND scope = 'ROOM' ORDER BY createdAt DESC LIMIT n` query.
- **Thread messages**: `(threadId, createdAt DESC)` — isolates private group conversation queries from the main room index.
- **Session member lookup**: `(roomId, leftAt)` — used when computing active membership counts and admission checks.

---

## Engineering Decisions and Trade-offs

**CRDT over OT for collaborative editing.** Operational Transformation requires a central authority to serialize concurrent operations. Yjs's CRDT model lets the server be a pure relay — it never deserializes or transforms document content — which eliminates a class of consistency bugs and simplifies the server considerably. The trade-off is slightly larger update payloads compared to minimal OT deltas.

**WebRTC P2P over SFU.** A Selective Forwarding Unit (Mediasoup, LiveKit) scales video better for large rooms but adds operational complexity and cost. For small engineering sessions (2–8 peers), full-mesh P2P is simpler, cheaper, and has lower latency because media is not re-encoded server-side. The signaling layer is already abstracted; swapping to an SFU is an option when room size requirements grow.

**Self-hosted Piston over a managed execution API.** Managed APIs (Judge0 Cloud, etc.) introduce per-execution cost, external latency, and a dependency on third-party availability. Running Piston inside the Docker Compose stack keeps execution latency low and cost fixed.

**Supabase for Auth, not for data.** Supabase Auth handles OAuth and OTP flows well; its database is not used. All application data lives in a Neon-hosted PostgreSQL instance managed entirely via Prisma. This avoids vendor lock-in on the data layer and gives full control over schema and migrations.

**Redis LRU cap.** Redis is configured with `maxmemory 256mb` and `allkeys-lru` eviction. Socket.IO's adapter uses Redis only for pub/sub (ephemeral, not persisted), so LRU eviction of old pub/sub data is acceptable. AOF persistence (`appendonly yes`) is enabled for operational safety — if Redis restarts, the adapter reconnects and re-subscribes.

---

## Contributing

This is a private repository. Contributions are by invitation only. If you have access:

1. Branch from `main`. Branch naming: `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`.
2. Keep PRs focused. One logical change per PR.
3. Backend changes require passing `npm test` (Node built-in test runner, `test/*.test.js`).
4. Schema changes must include a Prisma migration file (`npx prisma migrate dev --name <desc>`).
5. Do not commit `.env` files, credentials, or build artifacts.
6. All socket event handlers must pass through the appropriate guard functions (`assertAuthenticated`, `assertSocketInRoom`, payload size validation) before any business logic.

---

## Math rendering test

Inline math like $E = mc^2$ or the rate-limit window $\frac{200}{10s}$ should sit naturally in a sentence.

A block equation using dollar delimiters, with an `align` environment:

$$
\begin{align}
x + y &= 2 \\
2x - y &= 4
\end{align}
$$

The same thing via a fenced math block instead of `$$`:

```math
\begin{align}
a^2 + b^2 &= c^2 \\
c &= \sqrt{a^2 + b^2}
\end{align}
```

## License

All rights reserved. No reproduction, distribution, or commercial use permitted without written permission.

Contact: gourab.choudhury@synccode.in
