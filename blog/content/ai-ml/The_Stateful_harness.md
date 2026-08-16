# The Stateful Harness

### A state architecture for production AI agents, assembled from event sourcing, durable execution, context budgeting, and the GenAI observability conventions

The primitives in this article are old and well documented: event sourcing, idempotency, checkpointing, Lamport clocks, single writer ownership. None of them are mine. The argument I am making is that memory, observability, cost and resilience in agent systems are four views of one substrate, and that building them as separate subsystems is why agents that pass evaluation still fail in production.

Claims carry one of four tags so you can tell what is standard practice from what is my proposal:

**[Established]** documented, citable, safe to build on. **[Proposed]** my design, reasonable, not validated at scale. **[Heuristic]** a working approximation, tune it against your own data. **[Unverified]** a hypothesis I find persuasive and cannot defend with numbers.

Nine formulas, nine diagrams, two code blocks, one bibliography.

---

## 1. A failure mode worth designing against

*What follows is a composite scenario rather than an incident report. Every step is a documented failure class; the combination is illustrative.*

A support agent receives a routine question: where is my refund?

It calls `lookup_order`. Timeout. Retry. Success. It calls `check_refund_status`, gets a stale row from a read replica, and concludes no refund was issued. It calls `issue_refund`. The payment provider accepts.

The orchestrator pod is then evicted mid turn.

A replacement pod resumes the session. It has the conversation transcript, because that was in Postgres. It does not have the fact that `issue_refund` already fired, because that lived in a Python object on the dead pod. Reasoning from the transcript, it reaches the same conclusion and issues the refund again.

Now run the incident review.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Question\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Where you look\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">What you find\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">What did the agent \<i>do\</i>?\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Traces\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Multiple \<code>issue\_refund\</code> spans, no shared parent tying them to one intent\</td> \</tr> \<tr style="background:#f8fafc;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Why did it \<i>decide\</i> that?\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Memory\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Nothing. The reasoning was never persisted\</td> \</tr> \<tr style="background:#ffffff;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">What did it \<i>cost\</i>?\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Billing\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Token spend in one dashboard, refund exposure in another\</td> \</tr> \</tbody> \</table> 

Three systems, three teams, one cause: the agent had no durable, unambiguous record of what it had already done to the outside world.

A fair objection is that the root cause is not memory at all. It is missing idempotency, a stale read, and non durable execution state, which are three separate defects. That is correct. The claim of this article is that in agent systems those three defects share a substrate, and fixing them separately produces three half solutions.

---

## 2. The claim

The current harness literature draws the harness as layers: information, execution, feedback. Senses, hands, immune system. That framing is sound and it is where most teams should start.

Layer diagrams hide one thing, though, and the hidden thing is what breaks at three in the morning.

> **[Proposed] Thesis.** A harness is a distributed stateful system that happens to call a model. Memory is state you chose to keep. Observability is state you chose to keep about the harness itself, plus derived telemetry. Cost is dominated by, though not reducible to, the state you carried into the context window. Resilience is your ability to reconstruct state after a failure, and to detect when you cannot.

The qualifiers matter. Cost also includes output tokens, embeddings, reranking, evaluator calls and infrastructure. Observability also includes sampling, aggregation and correlation with systems outside the agent. The thesis is that carried state is the largest controllable term in each, not the only term.

```
flowchart TB
    subgraph OLD[" The layered view: correct, and incomplete "]
        direction LR
        A1[["Information"]] --> A2[["Execution"]] --> A3[["Feedback"]]
    end

    subgraph NEW[" The stateful view: same parts, re-centred "]
        direction TB
        L[("STATE LEDGER<br/>append-only event log")]
        M[["Memory<br/><i>what we recall</i>"]] --> L
        O[["Observability<br/><i>what we recorded</i>"]] --> L
        C[["Cost<br/><i>what we carried</i>"]] --> L
        R[["Resilience<br/><i>what we replay</i>"]] --> L
    end

    OLD -.-> NEW

    classDef anchor fill:#dbeafe,stroke:#1d4ed8,stroke-width:3px,color:#0f172a
    classDef node fill:#e2e8f0,stroke:#475569,stroke-width:1.5px,color:#0f172a
    classDef faded fill:#f1f5f9,stroke:#94a3b8,stroke-width:1.5px,color:#334155
    class L anchor
    class M,O,C,R node
    class A1,A2,A3 faded
    style OLD fill:transparent,stroke:#94a3b8,stroke-dasharray:5 5
    style NEW fill:transparent,stroke:#64748b,stroke-width:2px

```

*Figure 1. Not new components. A different centre of gravity.*

---

## 3. The state ledger

### 3.1 The model

**[Established]** An agent run is a sequence of events, not messages. A message is what the model said. An event is anything that changed the world, or the agent's belief about it.

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$S\_t = \text{fold}(\rho,; S\_0,; E\_{1..t}) \qquad \rho: (S, e) \rightarrow S'$$

 \<div style="font-size:14px;color:#334155;margin-top:10px;">State is computed by replaying what happened, rather than stored as a mutable value.\</div> \</div> 

This is event sourcing, documented since the early 2000s.

One correction to a claim I have seen asserted often, including in my own earlier draft. The line *if you store state directly, a crash loses it* is false. A durably persisted snapshot survives a crash perfectly well. The real distinction is three way.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Approach\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:center;">Survives crash\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:center;">Explains itself\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Replay cost\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Mutable state in process memory\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;text-align\:center;">No\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;text-align\:center;">No\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">n/a\</td> \</tr> \<tr style="background:#f8fafc;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Durable snapshot only\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;text-align\:center;">Yes\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;text-align\:center;">No. You see the result, never the path\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">None\</td> \</tr> \<tr style="background:#ffffff;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">\<b>Event log plus periodic snapshots\</b>\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;text-align\:center;">Yes\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;text-align\:center;">Yes\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Bounded by snapshot interval\</td> \</tr> \</tbody> \</table> 

**[Established]** The third row is the production answer, and the snapshot is not optional. Replaying ten million events to answer one question is not an architecture, it is a penance. Snapshot at a fixed event offset and replay only the tail.

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$S\_t = \text{fold}(\rho,; \text{Snapshot}*k,; E*{k+1..t})$$

 \</div> 

### 3.2 What the ledger is not

Every misuse of this pattern starts here.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#7f1d1d;color:#fef2f2;"> \<th style="padding:12px 14px;border:1px solid #991b1b;text-align\:left;">The ledger is not\</th> \<th style="padding:12px 14px;border:1px solid #991b1b;text-align\:left;">Because\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">A database snapshot\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">It is the derivation \<i>of\</i> one\</td> \</tr> \<tr style="background:#f8fafc;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">A trace\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">The trace is a projection; the ledger is the source\</td> \</tr> \<tr style="background:#ffffff;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">\<b>External truth\</b>\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">It records what your system \<b>believes\</b> happened\</td> \</tr> \<tr style="background:#f8fafc;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">The model's reasoning\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">It records the model's \<i>stated\</i> rationale, which is a different thing\</td> \</tr> \<tr style="background:#ffffff;color:#0f172a;"> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">An audit proof on its own\</td> \<td style="padding:11px 14px;border:1px solid #cbd5e1;">Proof requires counter-signature from the system that acted\</td> \</tr> \</tbody> \</table> 

The third row carries the weight. Your ledger can say `refund.completed` while the payment provider has no such record, or the reverse. A local append is not evidence of a remote effect, and Section 5 exists entirely to address that gap.

The fourth row deserves care in a piece about observability. Capturing a model's stated justification for a tool choice is valuable, because it turns a log into something you can argue with. But a stated rationale is a post hoc explanation, not a causal trace of the computation. Store it in a field called `rationale`, never one called `why`, or you build explanation theatre.

### 3.3 A minimal event vocabulary

**[Proposed]** What follows is a design proposal, not a survey finding. These events have been sufficient for the agents I have built; your domain will need more. The point is not the exact list. The point is that the list should be small, named honestly, and stable.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Event\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Emitted when\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Must carry\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>TurnOpened\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Input arrives\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">turn id, session id, raw input\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>ContextAssembled\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Prompt built\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">token counts by source, cache breakpoints, utilisation\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>PlanProposed\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Model returns a plan\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">plan hash, alternatives surfaced\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>ToolIntentRecorded\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Model requests a tool, before gating\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">tool, arguments, rationale\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>GuardrailEvaluated\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Any check runs\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">check id, verdict: pass, block, \<b>skip\</b>\</td>\</tr> \<tr style="background:#fef3c7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #d97706;">\<code>EffectAttempted\</code>\</td>\<td style="padding:10px 14px;border:1px solid #d97706;">Immediately before an external call\</td>\<td style="padding:10px 14px;border:1px solid #d97706;">idempotency key, target system\</td>\</tr> \<tr style="background:#fef3c7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #d97706;">\<code>EffectOutcomeObserved\</code>\</td>\<td style="padding:10px 14px;border:1px solid #d97706;">Call returns, times out, or is reconciled\</td>\<td style="padding:10px 14px;border:1px solid #d97706;">outcome: confirmed, refused, \<b>unknown\</b>\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>MemoryCommitted\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Something written to recall\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">tier, salience, scope, expiry\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>HandoffIssued\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Control passes to another agent\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">state diff, burned keys, Lamport clock\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>TurnClosed\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Response emitted\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">outcome class, cost, evaluation scores\</td>\</tr> \</tbody> \</table> 

Two notes on naming, both of which I got wrong in an earlier version.

**There is no** **`ToolExecuted`** **event.** There cannot be one written by the caller, because the caller does not know. There is an attempt, and there is an observation of an outcome, and the outcome has three values rather than two. Collapsing them into a single past tense event is the defect that Section 5 exists to fix.

**`GuardrailEvaluated`** **must emit on skip.** Most systems emit telemetry only on failure, which creates a silent ambiguity: a check that never ran looks exactly like a check that passed. Your dashboard is green while your guardrail has been disabled by a config typo for six weeks. Emit every evaluation and derive a coverage metric, described in the observability section.

### 3.4 Versions, or your replay is fiction

**[Established]** Six months from now you will change the reducer, and every historical event will fold into a different state than it originally did. Without recorded versions you cannot tell whether a replay diverged because of a bug or because of a deployment. Every event needs a version block alongside its payload.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Field\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Without it, you cannot answer\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>reducer\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Did the fold logic change between then and now?\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>schema\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Can this old event still be parsed?\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>model\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Was this decision made by the model we run today?\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>prompt\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Which procedural memory was resident?\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>tools\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Did the tool's behaviour change under the same name?\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<code>policy\</code>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Which guardrail bundle was in force?\</td>\</tr> \</tbody> \</table> 

Alongside these, every event carries a stable hash of its own intent, computed over type and payload. That hash does real work later: it is what loop detection counts.

### 3.5 Replay is not re-execution

**[Established]** Three distinct operations get called replay, and the distinction decides what your architecture can honestly promise.

```
flowchart TB
    R1[/"1 · State replay<br/>fold events into recorded state"/]
    R2[["2 · Tool replay<br/>re-issue external calls"]]
    R3{{"3 · Behavioural replay<br/>same context, same decision"}}
    R1 --> R2 --> R3
    V1>"Deterministic"] -.- R1
    V2>"Needs idempotency"] -.- R2
    V3>"Not achievable"] -.- R3

    classDef ok fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#0f172a
    classDef warn fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#0f172a
    classDef no fill:#fee2e2,stroke:#b91c1c,stroke-width:2px,color:#0f172a
    class R1,V1 ok
    class R2,V2 warn
    class R3,V3 no

```

*Figure 2. Only the first rung is free.*

State replay is deterministic if you store the events and the reducer version, and that is the property worth building on.

Behavioural replay is not achievable and should never be promised. Sampling, model updates, retrieval index drift and tool version changes all mean the same context can produce a different decision. An event sourced agent can reconstruct what the system recorded. It cannot guarantee what the model would do again.

**[Proposed]** The practical consequence: on recovery, do not re-run the model to work out where you were. Read the ledger, restore state, resume from the recorded position in the state machine. Re-deriving position by re-prompting is precisely how you get the duplicate refund.

---

## 4. Memory as constrained allocation

**[Proposed]** Teams build memory as retrieval: embed the query, pull top k, paste. Top k has no notion of a budget, no notion of what else competes for the same window, and no notion of token cost. Context assembly is better modelled as constrained allocation. You have a token budget, candidate memories with a value and a cost, and you must choose a subset.

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$\max \sum\_i v\_i x\_i \quad \text{subject to} \quad \sum\_i t\_i x\_i \le B, \quad x\_i \in {0,1}$$

 \<div style="font-size:14px;color:#334155;margin-top:10px;">Choose which memories enter the window, given what each is worth and what each costs.\</div> \</div> 

**[Established]** That is 0/1 knapsack, which is NP hard. In production you use a greedy approximation by value density, meaning value divided by tokens. This is not generally optimal, since a single large item can beat several dense small ones, but it is fast, it is within a bounded factor of the fractional optimum, and it beats similarity ranking decisively. Call it an approximation, because that is what it is.

The payoff of the reframe is concrete. A forty token user preference that changes every answer outranks a nine hundred token document chunk that shifts one sentence. Similarity ranking gets this backwards every time.

### 4.1 Scoring value

**[Heuristic]** A workable value function has four terms. The weights below are illustrative starting points, not empirically derived. Treat them as a shape to tune against your own outcome data.

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$v\_i = \underbrace{\alpha \cos(\mathbf{e}*i, \mathbf{e}q)}{\text{relevance}} + \underbrace{\beta e^{-\lambda \Delta t\_i}}*{\text{recency}} + \underbrace{\gamma \sigma\_i}*{\text{salience}} - \underbrace{\delta f\_i}*{\text{redundancy}}$$

 \<div style="font-size:14px;color:#334155;margin-top:10px;">Relevant, recent, important, and not already said.\</div> \</div> \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Term\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Encodes\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:center;">Start at\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Note\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Cosine similarity\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Semantic match\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">0.45\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Necessary, never sufficient\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Exponential decay\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Recency\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">0.20\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Set half life near session length\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Salience\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Correction, preference, constraint\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">0.30\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Where the harness earns its keep\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Redundancy penalty\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Overlap with what is already chosen\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">0.15\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Kills five chunks of one paragraph\</td>\</tr> \</tbody> \</table> 

### 4.2 Corrections are high priority, not immortal

**[Proposed]** An earlier draft of this argued that human corrections should outrank competing memories permanently. That is a defect waiting to happen, because permanent memory becomes permanent misinformation. Corrections get revoked, superseded, scoped to one customer, or turn out to be wrong.

Every memory therefore needs provenance and a validity envelope: a source, a confidence, an explicit scope covering tenant and user and workflow, a valid from and valid until, a pointer to whatever it supersedes, and a revocation timestamp.

The scoping field is the one that saves you. *This customer prefers email* is not *all customers prefer email*, and a memory system that cannot express the difference will confidently generalise one person's preference across your entire book of business.

### 4.3 Five tiers

```
flowchart LR
    Q([Turn input]) --> SEL{{"Selector<br/>greedy by value/tokens<br/>under budget B"}}

    subgraph WARM[" Warm: retrieved on demand "]
        direction TB
        EP[("Episodic<br/>past turns, outcomes")]
        SE[("Semantic<br/>facts, preferences")]
    end
    subgraph SHR[" Shared: cross-agent "]
        BB[("Blackboard<br/>task state, claims")]
    end
    subgraph HOT[" Hot: resident every call "]
        direction TB
        P[/"Procedural<br/>rules, tools, style"/]
        W[/"Working<br/>current turn"/]
    end

    EP --> SEL
    SE --> SEL
    BB --> SEL
    P --> SEL
    SEL --> W
    W --> CTX[["Assembled context"]]
    CTX --> LLM((Model))
    LLM -.->|distil| EP
    LLM -.->|extract| SE
    LLM -.->|claim| BB

    classDef hot fill:#fee2e2,stroke:#b91c1c,stroke-width:2px,color:#0f172a
    classDef warm fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#0f172a
    classDef shr fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#0f172a
    classDef sel fill:#fef3c7,stroke:#b45309,stroke-width:2.5px,color:#0f172a
    classDef neutral fill:#e2e8f0,stroke:#475569,stroke-width:1.5px,color:#0f172a
    class W,P hot
    class EP,SE warm
    class BB shr
    class SEL sel
    class Q,CTX,LLM neutral
    style HOT fill:transparent,stroke:#64748b,stroke-width:2px
    style WARM fill:transparent,stroke:#64748b,stroke-width:2px
    style SHR fill:transparent,stroke:#64748b,stroke-width:2px

```

*Figure 3. Cold storage is cheap. Context is not. The selector, drawn as a gate, is the expensive decision.*

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Tier\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Lifetime\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Write policy\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Read budget\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Cost driver\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Working\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">One turn\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Automatic\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Resident\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Highest, billed every call\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Procedural\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Deploy to deploy\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Versioned, reviewed\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Cached prefix\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Low if cache aligned\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Episodic\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Session to retention limit\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Distilled at turn close\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Under 80 ms\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Storage and embedding\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Semantic\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Until superseded\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Extracted, deduped, scoped\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Under 120 ms\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Storage and drift\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Blackboard\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Task lifetime\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Single writer or compare and swap\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Under 30 ms\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Contention, not tokens\</td>\</tr> \</tbody> \</table> 

### 4.4 Cache aligned assembly

**[Established]** Prefix caching applies only to an unchanged prefix. Put a timestamp, session id or user name in your system prompt and the prefix differs on every call, so nothing is reused. This is documented provider behaviour rather than a claim about your bill. What it costs is worked out with real arithmetic in the cost section.

The selector below is the first of only two code blocks in this article, and it is here because the ordering of its three returned segments is the whole point.

```
def assemble_context(ledger, query, budget_tokens, tokenizer):
    """Stable prefix, then selected memories, then the volatile tail."""

    stable_prefix = load_procedural()          # no per-request content, ever
    prefix_tokens = tokenizer.count(stable_prefix)
    remaining     = budget_tokens - prefix_tokens - RESERVED_FOR_TAIL

    candidates = retrieve(query, k=60)         # over-retrieve, then select
    selected   = []
    used       = 0
    chosen     = []

    ranked = sorted(
        candidates,
        key=lambda m: value(m, query, chosen) / m.tokens,
        reverse=True,
    )

    for memory in ranked:
        if used + memory.tokens > remaining:
            continue                           # try smaller items, do not break

        selected.append(memory)
        chosen.append(memory.vec)
        used += memory.tokens

    ledger.append("ContextAssembled", {
        "prefix_tokens": prefix_tokens,
        "memory_tokens": used,
        "considered":    len(candidates),
        "used":          len(selected),
        "utilisation":   round(used / max(remaining, 1), 3),
    })

    return [
        {"text": stable_prefix, "cache_control": {"type": "ephemeral"}},
        {"text": render(selected)},
        {"text": query.text},
    ]

```

**[Heuristic]** The utilisation figure is the most useful memory metric I know. Consistently at 0.3 means retrieval is too timid. Consistently at 0.99 with truncation means you are paying for tokens the model discards. Plot its distribution weekly rather than watching its average.

---

## 5. The ambiguous side effect

This is the hardest problem in the article and it deserves the space.

### 5.1 The law

> **[Established]** You cannot atomically append to your ledger and mutate an external system. Unless that system enlists in your transaction, and it will not, there is always a window in which you do not know whether the effect landed.

Write ordering does not eliminate this. It only chooses which way you fail.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Order\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">A crash in the window means\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Failure mode\</th> \</tr> \</thead> \<tbody> \<tr style="background:#fef3c7;color:#0f172a;">\<td style="padding:11px 14px;border:1px solid #b45309;">Effect first, then record\</td>\<td style="padding:11px 14px;border:1px solid #b45309;">Effect landed, no record exists\</td>\<td style="padding:11px 14px;border:1px solid #b45309;">\<b>Duplicate on retry.\</b> Detectable\</td>\</tr> \<tr style="background:#fee2e2;color:#0f172a;">\<td style="padding:11px 14px;border:1px solid #b91c1c;">Record first, then effect\</td>\<td style="padding:11px 14px;border:1px solid #b91c1c;">Record exists, effect unknown\</td>\<td style="padding:11px 14px;border:1px solid #b91c1c;">\<b>Phantom.\</b> You believe it happened. Silent\</td>\</tr> \</tbody> \</table> 

An earlier version of this article recommended the second ordering and named the record `ToolExecuted`, which quietly asserts a fact the caller cannot know. That is worse than the first ordering, because a duplicate announces itself while a phantom does not.

The correct model has three outcome states, and the third is not a transient. It is a first class state that requires resolution by something other than guessing.

```
flowchart TB
    I[/"EffectAttempted<br/>durable, pre-call<br/>carries idempotency key"/]
    I --> CALL{{"External call"}}
    CALL -->|"acknowledged"| OK([CONFIRMED])
    CALL -->|"explicit refusal"| NO([REFUSED<br/>safe to retry])
    CALL -->|"timeout, crash,<br/>connection lost"| UNK{{"UNKNOWN"}}

    UNK --> REC{"Reconcile:<br/>ask the system<br/>that would know"}
    REC -->|"provider has the key"| OK
    REC -->|"provider has no record"| NO
    REC -->|"unresolved after budget"| ESC[\"Human review<br/>do not retry blindly"\]

    classDef ok fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#0f172a
    classDef bad fill:#fee2e2,stroke:#b91c1c,stroke-width:2.5px,color:#0f172a
    classDef unk fill:#f3e8ff,stroke:#7e22ce,stroke-width:2.5px,color:#0f172a
    classDef neutral fill:#e2e8f0,stroke:#475569,stroke-width:1.5px,color:#0f172a
    classDef dec fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#0f172a
    class OK,NO ok
    class ESC bad
    class UNK unk
    class I neutral
    class CALL,REC dec

```

*Figure 4. Unknown is a state you design for, not an error you swallow.*

### 5.2 Three defences, strongest first

**Provider side idempotency.** **[Established]** Send a stable idempotency key with the request. The receiving service, not you, guarantees that two requests carrying the same key produce one effect. This is how payment APIs solve the indeterminate outcome problem, and it is the only defence that actually closes the window. If your downstream supports keys and you are not sending one, you are relying on luck.

**Reconciliation.** **[Established]** For an unknown outcome, query the provider using the key you sent. Most systems that accept idempotency keys also allow lookup by one. This converts unknown into confirmed or refused after the fact.

**Compensation.** **[Established]** If the effect is irreversible and unqueryable, you need an inverse operation and a saga to run it. Expensive, and not always possible, since you cannot un-send an email.

**[Proposed]** A tool supporting none of the three should be classified as high risk in your registry and gated behind human approval rather than automated retry. Wrapping an unsafe operation in a confident retry loop is how you get four refunds.

### 5.3 The corrected implementation

This is the second and last code block, and it is the one that matters most.

```
class Outcome(str, Enum):
    CONFIRMED = "confirmed"     # the effect landed
    REFUSED   = "refused"       # definitively did not land, safe to retry
    UNKNOWN   = "unknown"       # indeterminate, must not be read as either


def execute_effect(ledger, tool, args, *, turn_id, agent_id):
    """The key derives from intent, so a regenerated identical intent reuses it."""

    key = hashlib.sha256(
        f"{ledger.session_id}|{turn_id}|{tool.name}|{canonical(args)}".encode()
    ).hexdigest()

    # 1. Has this key already resolved?
    prior = ledger.latest("EffectOutcomeObserved", idempotency_key=key)

    if prior and prior.payload["outcome"] == Outcome.CONFIRMED:
        return prior.payload["result"]              # safe replay

    if prior and prior.payload["outcome"] == Outcome.UNKNOWN:
        return reconcile(ledger, tool, key)         # never assume

    # 2. Record the attempt. Not the execution.
    ledger.append("EffectAttempted", {
        "tool":            tool.name,
        "args":            redact(args),
        "idempotency_key": key,
        "target":          tool.target_system,
    }, agent_id=agent_id, turn_id=turn_id)

    # 3. Call, passing the key downstream so the provider can deduplicate.
    try:
        result  = tool.invoke(**args, idempotency_key=key)
        outcome = Outcome.CONFIRMED

    except ToolRefused as exc:
        result, outcome = {"error": str(exc)}, Outcome.REFUSED

    except (TimeoutError, ConnectionError) as exc:
        result, outcome = {"error": str(exc)}, Outcome.UNKNOWN

    ledger.append("EffectOutcomeObserved", {
        "idempotency_key": key,
        "outcome":         outcome,
        "result":          truncate(result),
        "result_digest":   digest(result),
    }, agent_id=agent_id, turn_id=turn_id)

    if outcome == Outcome.UNKNOWN:
        return reconcile(ledger, tool, key)

    return result

```

Reconciliation is deliberately narrow. If the tool cannot be queried by key, it records that fact and raises for human review rather than retrying. If it can be queried, it polls with backoff up to a fixed attempt budget, writes the resolved outcome back to the ledger with a `via: reconciliation` marker, and only then returns.

Three things changed from the earlier version, and each was a real defect.

First, the events are named for what they are. `EffectAttempted` asserts an attempt and `EffectOutcomeObserved` asserts an observation. Neither claims knowledge the caller lacks.

Second, the short circuit fires only on a confirmed outcome. The old code returned the stored result on any prior match, including an in flight record that had no result field, which is a crash at best and a phantom success at worst.

Third, an unknown outcome routes to reconciliation and then to a person. It is never silently coerced into either success or failure.

**[Proposed]** The uncomfortable conclusion is that for genuinely irreversible and unqueryable operations there is no purely automated correct answer. The best an architecture can do is make the ambiguity visible, bounded, and routed to someone who can resolve it. Any design claiming otherwise is hiding the window rather than closing it.

---

## 6. Durable execution

### 6.1 The run as an explicit state machine

**[Proposed]** Stop modelling a run as a while loop and model it as a state machine whose transitions are ledger appends. Recovery then becomes a single instruction: read the last event, resume from that state, do not re-prompt.

The happy path runs straight across. Everything below the line is an exception path, and there are only three of them.

```
flowchart LR
    A([Turn opens]) --> B[["Assemble<br/>context"]]
    B --> C((Model))
    C --> D{{"Guardrail<br/>gate"}}
    D -->|pass| E[/"Attempt<br/>effect"/]
    E --> F{Outcome}
    F -->|confirmed<br/>or refused| C
    C --> Z([Respond])

    D -.->|block, with<br/>structured error| C
    F -.->|unknown| G[["Reconcile"]]
    G -.->|resolved| C
    G -.->|unresolved| H[\"Human review"\]

    classDef start fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#0f172a
    classDef proc fill:#e2e8f0,stroke:#475569,stroke-width:1.5px,color:#0f172a
    classDef gate fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#0f172a
    classDef stop fill:#fee2e2,stroke:#b91c1c,stroke-width:2px,color:#0f172a
    class A,Z start
    class B,C,E,G proc
    class D,F gate
    class H stop

```

*Figure 5. Solid lines are the normal path. Dotted lines are the three ways a turn deviates. Reconcile and human review are the two states most teams omit, and they are the two that prevent silent damage.*

### 6.2 How often to checkpoint

**[Heuristic]** The Young and Daly result gives a first order estimate for optimal checkpoint interval.

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$\tau^{\*} \approx \sqrt{2CM}$$

 \<div style="font-size:14px;color:#334155;margin-top:10px;">C is the cost of writing a checkpoint, M is mean time between failures.\</div> \</div> 

With a checkpoint cost of 40 milliseconds and a mean time between failures of four hours, the interval comes out near 34 seconds. The arithmetic is right. The transfer deserves scepticism.

Young and Daly assumes memoryless, independent failures in a regime where checkpoint cost dominates, which are assumptions drawn from high performance computing, where a job runs for days and all state is equally valuable. Agent turns last seconds, failures cluster around deployments, and state is emphatically not uniformly valuable. The record of an irreversible effect matters infinitely more than the record of a reasoning step.

**[Proposed]** So treat the formula as a sanity check on your time based interval, and let this rule dominate instead: checkpoint on semantic boundaries rather than clock ticks. Record durably before every external effect, and after every transition that changes what a recovering worker would do.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Recovery target\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Design implication\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">No phantom effects\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Attempt written synchronously before the call, carrying the key\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">No duplicate effects\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Keys propagated to every downstream that accepts them\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">At most one turn of reasoning lost\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Plan events batched and written asynchronously\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Resume in under two seconds\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Snapshot roughly every 200 events, replay only the tail\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Unknowns never silent\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Unknown count is a paging alert, not a dashboard tile\</td>\</tr> \</tbody> \</table> 

---

## 7. Multi-agent state

Add a second agent and you have built a distributed system, whether or not you meant to.

### 7.1 Quantifying staleness, carefully

If shared state replicates with a lag and writes to a key arrive as a Poisson process, the probability that at least one write lands during the window in which a reader's view is stale is the following.

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$P(\text{write during staleness window}) = 1 - e^{-\lambda\Delta}$$

 \<div style="font-size:14px;color:#334155;margin-top:10px;">Lambda is the write rate on that key. Delta is the replication lag.\</div> \</div> 

**[Heuristic]** Read that label precisely, because it is not the probability of a conflict. Whether a write becomes a conflict depends on whether it touches the same key, whether it contradicts the read, and whether the stale value would have changed the agent's action. This is a risk proxy useful for deciding which keys need an owner, not a conflict model.

With a lag of 200 milliseconds and two writes per second, the proxy gives roughly 33 percent. That is a signal to make that key single writer, and nothing more.

### 7.2 Three topologies

```
flowchart TB
    subgraph A[" A · Shared blackboard "]
        direction TB
        BB[("Blackboard")]
        A1[[Agent 1]] <--> BB
        A2[[Agent 2]] <--> BB
        A3[[Agent 3]] <--> BB
    end
    subgraph B[" B · Supervisor owns state "]
        direction TB
        S{{"Supervisor<br/>sole writer"}}
        S --> B1[[Worker 1]]
        S --> B2[[Worker 2]]
    end
    subgraph C[" C · Ledger and projections "]
        direction TB
        L[("Append-only ledger")]
        C1[[Agent 1]] --> L
        C2[[Agent 2]] --> L
        L -.->|subscribe| C1
        L -.->|subscribe| C2
    end

    classDef risky fill:#fee2e2,stroke:#b91c1c,stroke-width:2px,color:#0f172a
    classDef mid fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#0f172a
    classDef good fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#0f172a
    classDef neutral fill:#e2e8f0,stroke:#475569,stroke-width:1.5px,color:#0f172a
    class BB risky
    class S mid
    class L good
    class A1,A2,A3,B1,B2,C1,C2 neutral
    style A fill:transparent,stroke:#64748b,stroke-width:2px
    style B fill:transparent,stroke:#64748b,stroke-width:2px
    style C fill:transparent,stroke:#64748b,stroke-width:2px

```

*Figure 6. Pick one deliberately. Most teams arrive at the first by accident.*

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Blackboard\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Supervisor\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Ledger and projections\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Write conflicts\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Frequent, needs explicit control\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Excluded by construction\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Resolved by ordering\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Debuggability\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Poor, state has no history\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Good\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Best, history is the state\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Latency\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Lowest\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Extra hop per delegation\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Low read, ordered write\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Scales to many agents\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Degrades\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Supervisor bottlenecks\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Well\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Best for\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Prototypes\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Regulated, auditable flows\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Long running, many agents\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Failure mode\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Silent contradiction\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Single point of failure\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Projection lag\</td>\</tr> \</tbody> \</table> 

**[Proposed]** The default rule, stated at the right strength: prefer a single authoritative writer per mutable fact unless you have an explicit conflict resolution model. Multi writer is entirely legitimate with convergent replicated types, compare and swap on a version, leases with fencing tokens, or vector clocks. What is not legitimate is multi writer by accident, which is what a shared dictionary hands you.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Mechanism\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Gives you\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Costs you\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Single writer\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Simplicity, no conflicts\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Coordination bottleneck\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Compare and swap\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Conflict detection, cheap\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Caller must handle retry\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Lease with fencing token\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Safe exclusion under partition\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Clock and renewal complexity\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Convergent replicated type\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Convergence without coordination\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Restricted data types\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Vector clocks\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Concurrency detection\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Metadata growth\</td>\</tr> \</tbody> \</table> 

**[Established]** A Lamport counter gives a partial order, meaning it answers whether A's write preceded B's read, and nothing beyond that. It does not resolve concurrent writes, does not deliver exactly once, and does not cross external system boundaries. Useful, and frequently oversold.

### 7.3 Handoffs are typed contracts

**[Proposed]** Passing conversation history to another agent passes a transcript, and the receiver must re-derive everything expensively and lossily. Pass a typed diff instead. A handoff contract needs the sending and receiving agent, a one sentence goal, established facts with provenance, open questions stated explicitly so nothing is silently dropped, inherited constraints, the remaining budget, a Lamport clock, and two separate lists of effect keys: those resolved as confirmed, and those still unknown.

That last field prevents the multi-agent version of the duplicate refund. Without it, the second agent inherits a transcript suggesting a refund is owed, and no signal that the first agent may already have issued one.

---

## 8. Observability

Everything above produces a byproduct: an ordered, causally linked record. **[Proposed]** Observability then becomes largely a projection of the ledger rather than a parallel system, though not entirely, since sampling, aggregation and correlation with non-agent systems live outside it.

### 8.1 Speak the standard dialect, carefully

**[Established]** The OpenTelemetry GenAI semantic conventions define span names and attributes for model calls, agent invocations, tool execution, retrieval and memory operations, converging on `invoke_agent`, `chat` and `execute_tool` under a `gen_ai` namespace. The work moved to a dedicated repository in mid 2026.

Two cautions, and the first matters most. The conventions are explicitly in development status, not stable. Adopt the shape, meaning span nesting, token attributes and duration metrics, but isolate the literal attribute strings behind a thin mapping layer so a rename does not ripple through your codebase.

Second, the conventions themselves warn that captured inputs, system instructions and retrieval queries may contain sensitive data. Read the security subsection below before enabling content capture.

I have seen instrumentation overhead described as negligible. I am not quoting a figure, because overhead depends almost entirely on whether you capture prompt and completion content, at what sampling rate, and with what attribute cardinality. Measure your own workload rather than inheriting someone else's number.

### 8.2 One turn, one trace anchor

**[Proposed]** This is a design recommendation, not an OpenTelemetry requirement.

```
flowchart TB
    T([invoke_agent<br/>session abc · turn 7])
    T --> A1[["assemble_context<br/>prefix 6000 · memory 1840 · util 0.61"]]
    T --> C1[["chat<br/>input 7840 · cache read 6000"]]
    C1 --> G1{{"guardrail.pii<br/>pass"}}
    C1 --> G2{{"guardrail.spend_limit<br/>block"}}
    G2 --> C2[["chat retry<br/>input 8120 · cache read 6000"]]
    C2 --> E1[/"effect.issue_refund<br/>confirmed"/]
    T --> R([respond<br/>groundedness 0.94])

    classDef anchor fill:#dbeafe,stroke:#1d4ed8,stroke-width:2.5px,color:#0f172a
    classDef blocked fill:#fee2e2,stroke:#b91c1c,stroke-width:2px,color:#0f172a
    classDef passed fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#0f172a
    classDef neutral fill:#e2e8f0,stroke:#475569,stroke-width:1.5px,color:#0f172a
    class T,R anchor
    class G2 blocked
    class E1,G1 passed
    class A1,C1,C2 neutral

```

*Figure 7. Retries are sibling spans beneath one anchor, not new traces.*

If each retry opens its own trace you lose the ability to ask how many attempts a turn actually took, which is the best early warning for a loop that exists.

### 8.3 Four metrics that lead rather than lag

**Guardrail coverage ratio**, the silent skip detector.

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$\text{GCR} = \frac{\text{checks evaluated}}{\text{checks expected}}$$

 \</div> 

**[Proposed]** Set the threshold by the risk class of the guarded action rather than by a global number. A redactor on outbound text and a spend limit on a payment tool do not deserve the same tolerance. The second should alert on any miss at all; the first can absorb a sampled gap.

**Repeated action ratio.** **[Proposed]** A more reliable loop signal than entropy. Over a sliding window, take the fraction of actions whose intent hash has already appeared. Three identical hashes is a trigger. Because the hash covers arguments as well as tool name, a workflow that legitimately calls one tool many times with different inputs does not fire it.

**Trajectory entropy, paired with a progress term.**

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$H = -\sum\_{a} p(a)\log p(a)$$

 \</div> 

**[Unverified]** An earlier version claimed low entropy plus no progress means a loop, and high entropy plus no progress means lost. That is too simple. Low entropy also describes an agent correctly executing a deterministic workflow, and high entropy also describes legitimate search. Entropy alone contains no progress signal and is interpretable only alongside one, such as new information acquired or goal distance reduced. I offer the combination as a hypothesis worth instrumenting, not a validated detector.

**Cost per outcome, with an explicit taxonomy.**

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$\text{Cost per resolved} = \frac{\sum \text{cost}}{|{\text{turns where outcome is resolved}}|}$$

 \</div> 

**[Proposed]** This metric is gameable, since an agent that refuses hard tasks improves it. Classify every closed turn as resolved, partially resolved, handed to a human, abandoned or failed, then always report cost per resolved alongside cost per attempted and the resolution rate. The pair cannot be gamed by refusal. Either number alone can.

### 8.4 The ledger is also a liability

**[Established]** Everything above argues for storing raw inputs, tool arguments, results, rationales and memories, which is also a description of a high value breach target.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#7f1d1d;color:#fef2f2;"> \<th style="padding:12px 14px;border:1px solid #991b1b;text-align\:left;">Concern\</th> \<th style="padding:12px 14px;border:1px solid #991b1b;text-align\:left;">Requirement\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Personal and health and payment data\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Classify at write time, redact in the append path rather than the read path\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Secrets\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Never in arguments, store a credential reference and never a value\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Tenant isolation\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Partition key includes tenant, enforced at the storage layer\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Retention\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Per tier expiry. A ledger is not a licence to keep everything forever\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">\<b>Right to erasure\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Append-only logs and deletion conflict. Use crypto shredding rather than mutating history\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Access control\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Reading a ledger is reading customer conversations. Audit that access\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Prompt injection\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Tool arguments may be attacker influenced. Never render raw into a dashboard\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Content capture\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Sampled, opt in per environment, off by default in production\</td>\</tr> \</tbody> \</table> 

**[Proposed]** Crypto shredding deserves a sentence of its own, because it resolves the genuine tension between an append only log and a legal deletion obligation. Encrypt per subject payloads with a per subject key, then delete the key. The events remain ordered and intact while their contents become unreadable.

---

## 9. Cost, worked rather than asserted

### 9.1 The session cost model

For a session of N model calls with a static prefix, variable content per call and generated output:

 \<div style="background:#f1f5f9;border-left:5px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:22px 0;box-shadow:0 2px 8px rgba(0,0,0,0.12);color:#0f172a;"> 

$$C = p\_{\text{in}}\Big[1.25P + 0.1P(N-1) + \sum\_i D\_i\Big] + p\_{\text{out}}\sum\_i O\_i + C\_{\text{infra}}$$

 \<div style="font-size:14px;color:#334155;margin-top:10px;">P is the static prefix. D is variable content per call. O is output. The bracket is what caching acts on.\</div> \</div> 

**[Established]** The coefficients reflect published provider mechanics as of mid 2026. Cache writes bill above the base input rate and cache reads bill at a fraction of it, with Anthropic publishing 1.25 times for writes and 0.1 times for reads. Check the live rate card before architecting around any number here, because these move.

The infrastructure term covers embeddings, reranking, vector storage, evaluator calls and orchestration. That is real money not covered by token math, and frequently 15 to 30 percent of the total in retrieval heavy systems.

### 9.2 What breaking the prefix cache actually costs

Rather than asserting a multiplier, here is the arithmetic, with assumptions stated so you can substitute your own. Take a 6,000 token prefix of system prompt plus tool definitions, eight calls per session, and 2,000 tokens of variable content per call.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Scenario\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Calculation\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:right;">Billable equivalent\</th> \</tr> \</thead> \<tbody> \<tr style="background:#fee2e2;color:#0f172a;">\<td style="padding:11px 14px;border:1px solid #b91c1c;">Prefix changes every call\</td>\<td style="padding:11px 14px;border:1px solid #b91c1c;">8 × (6,000 + 2,000)\</td>\<td style="padding:11px 14px;border:1px solid #b91c1c;text-align\:right;">\<b>64,000\</b>\</td>\</tr> \<tr style="background:#dcfce7;color:#0f172a;">\<td style="padding:11px 14px;border:1px solid #15803d;">Prefix stable and cached\</td>\<td style="padding:11px 14px;border:1px solid #15803d;">7,500 write + 4,200 reads + 16,000 variable\</td>\<td style="padding:11px 14px;border:1px solid #15803d;text-align\:right;">\<b>27,700\</b>\</td>\</tr> \</tbody> \</table> 

That is a 56.7 percent reduction. Inverted, putting a timestamp in that system prompt multiplies input cost by 2.31 times, in this configuration.

**[Heuristic]** That is where the claim about doubling your bill comes from, and it holds only for prefix heavy sessions with many turns. With a 500 token prefix and two calls per session the same mistake costs almost nothing. The lever scales with prefix size multiplied by call count, so measure yours before quoting anyone's multiplier, mine included.

Break even arrives fast. The write premium is recovered once roughly 1.3 calls have read the same prefix, meaning two calls within the cache lifetime. The binding constraint is almost never call count. It is whether the prefix survives unchanged.

### 9.3 The levers, ranked by return on effort

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Lever\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Typical effect\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Effort\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Risk\</th> \</tr> \</thead> \<tbody> \<tr style="background:#dcfce7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #15803d;">\<b>Move static content to the prefix\</b>\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">Large on prefix heavy loops\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">Trivial\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">None. Do this first\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Explicit cache breakpoints and lifetime tuning\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Moderate\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Low\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Low, provider specific\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Model routing by task difficulty\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Large where easy tasks dominate\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Medium\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Quality regression, needs a router eval\</td>\</tr> \<tr style="background:#fef3c7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #b45309;">Context compaction\</td>\<td style="padding:10px 14px;border:1px solid #b45309;">Moderate on long sessions\</td>\<td style="padding:10px 14px;border:1px solid #b45309;">Medium\</td>\<td style="padding:10px 14px;border:1px solid #b45309;">\<b>Destroys the cache if done wrong\</b>\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Batch or async for non interactive work\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Large on eligible traffic\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Low\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Latency, only where nobody waits\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Reduce retries via better guardrail errors\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Underrated\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Medium\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">None\</td>\</tr> \</tbody> \</table> 

**[Established]** Published measurement exists for the first lever. A January 2026 cross provider study of long horizon agentic tasks reported cost reductions of 41 to 80 percent and time to first token improvements of 13 to 31 percent from prompt caching. Its counterintuitive finding was that caching everything, including volatile tool results, can increase latency, while caching only the stable prefix delivered more consistent benefit. That matches the assembly rule given in the memory section, and it is the one figure in this article I did not compute myself.

**[Unverified]** The last row is my own emphasis and is unmeasured. A guardrail returning *blocked: field amount exceeds tenant limit 500, revise and resubmit* costs one retry. A guardrail returning *error* costs three or four. Retry count is a cost line item that almost nobody attributes to error message quality.

### 9.4 Compaction without cache destruction

**[Proposed]** Compaction and caching pull against each other, since rewriting history invalidates the cached prefix. A compactor firing every turn can cost more than it saves. Four conditions should all hold before it runs: the context is genuinely over its high water mark, a minimum number of turns has passed since the last compaction, the cache lifetime has already expired so invalidation is free, and no effect is currently in an unknown state.

That third condition is the one people miss. Compacting while the cache is still warm pays the invalidation cost for nothing.

---

## 10. Degrading instead of breaking

**[Proposed]** Unbreakable is marketing. Systems break. The engineering goal is that they break predictably, visibly, and in a direction that does not cause damage.

```
flowchart TB
    N([Normal<br/>full capability]) -->|latency or cost rising| L1[["Cheaper model<br/>reduced tool set"]]
    L1 -->|repeated actions detected| L2{{"Break loop<br/>force one re-plan"}}
    L2 -->|budget exhausted| L3[/"Read-only mode<br/>no external effects"/]
    L3 -->|outcome unresolved| L4[\"Human handoff<br/>with full ledger context"\]
    L4 -->|dependency down| L5([Honest refusal<br/>state what is unavailable])

    classDef ok fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#0f172a
    classDef warn fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#0f172a
    classDef caution fill:#ffedd5,stroke:#c2410c,stroke-width:2px,color:#0f172a
    classDef stop fill:#fee2e2,stroke:#b91c1c,stroke-width:2px,color:#0f172a
    class N ok
    class L1,L2 warn
    class L3 caution
    class L4,L5 stop

```

*Figure 8. Every rung stays useful. None of them silently produces a wrong action.*

The ordering encodes one principle: surrender capability before surrendering correctness. A read only agent saying *I can see your order but cannot issue the refund right now* is a good outcome. An agent issuing four refunds is not.

### 10.1 Budgets as safety mechanisms

**[Proposed]** A budget is usually framed as cost control. It is also the cheapest circuit breaker you own, because it bounds every runaway mode at once.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Budget\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Bounds\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Exceeding it should\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Tokens per turn\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Context explosion\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Force compaction, then degrade\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Model calls per turn\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Reasoning loops\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Break the loop, re-plan once\</td>\</tr> \<tr style="background:#fee2e2;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #b91c1c;">\<b>Effects per turn\</b>\</td>\<td style="padding:10px 14px;border:1px solid #b91c1c;">The four refunds class of failure\</td>\<td style="padding:10px 14px;border:1px solid #b91c1c;">\<b>Hard stop, human review\</b>\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Wall clock per turn\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Hung dependencies\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Return partial with explanation\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Cost per session\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Aggregate runaway\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Degrade tier, notify\</td>\</tr> \</tbody> \</table> 

The third row is the one worth arguing for in a design review. An agent that has issued two irreversible effects inside a single turn is almost never doing what you intended, whatever its reasoning trace says.

---

## 11. Reference architecture

```
flowchart TB
    U([User or caller]) --> GW[/"Gateway<br/>auth · quota · routing"/]
    GW --> ORCH[["Orchestrator<br/>state machine · budgets"]]

    subgraph PLANE[" Execution plane "]
        direction LR
        ORCH --> SEL{{"Context selector"}}
        SEL --> MODEL((Model))
        MODEL --> GATE{{"Guardrails<br/>pass · block · skip"}}
        GATE --> EFF[/"Effect executor<br/>keys and reconciliation"/]
    end

    subgraph STATE[" State plane "]
        direction LR
        LED[("State ledger<br/>append-only")]
        SNAP[("Snapshots")]
        MEM[("Memory tiers")]
    end

    subgraph DERIVED[" Derived views "]
        direction LR
        OTEL[["Spans"]]
        FIN[["Cost per outcome"]]
        EVAL[["Evaluation scores"]]
    end

    ORCH <--> LED
    EFF --> LED
    GATE --> LED
    SEL <--> MEM
    LED --> SNAP
    LED --> MEM
    LED -.-> OTEL
    LED -.-> FIN
    LED -.-> EVAL
    EFF --> EXT[\"External systems<br/>keys accepted · lookup supported"\]

    classDef anchor fill:#dbeafe,stroke:#1d4ed8,stroke-width:3px,color:#0f172a
    classDef neutral fill:#e2e8f0,stroke:#475569,stroke-width:1.5px,color:#0f172a
    classDef gate fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#0f172a
    classDef ext fill:#f3e8ff,stroke:#7e22ce,stroke-width:2px,color:#0f172a
    classDef store fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#0f172a
    class LED anchor
    class GATE,SEL gate
    class EXT ext
    class SNAP,MEM store
    class U,GW,ORCH,MODEL,EFF,OTEL,FIN,EVAL neutral
    style PLANE fill:transparent,stroke:#64748b,stroke-width:2px
    style STATE fill:transparent,stroke:#64748b,stroke-width:2px
    style DERIVED fill:transparent,stroke:#64748b,stroke-width:2px

```

*Figure 9. Three planes. Dotted lines mark projections. Nothing in the derived views is a second source of truth.*

---

## 12. Getting there from where you are

**[Proposed]** A migration order chosen so that each phase is independently valuable. You can stop after any of them and be better off than when you started.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:center;">Phase\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Do\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Why here\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Done when\</th> \</tr> \</thead> \<tbody> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">\<b>1\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Idempotency keys on every mutating tool, propagated downstream\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Highest damage reduction per hour spent\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">No tool can fire twice for one intent\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">\<b>2\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Attempt and outcome events with a real unknown state\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Makes ambiguity visible instead of silent\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Unknown count pages someone\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">\<b>3\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Append-only ledger, snapshots, versions recorded\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Everything later derives from this\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">A new worker resumes without re-prompting\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">\<b>4\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Spans projected from the ledger\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Cheap once phase three exists\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">One turn equals one trace anchor\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">\<b>5\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Context selector with utilisation logging\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Cost work needs measurement first\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">You can name your most expensive segment\</td>\</tr> \<tr style="background:#f8fafc;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">\<b>6\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Budgets and the degradation ladder\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Needs the ledger to enforce against\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Every runaway mode has a bound\</td>\</tr> \<tr style="background:#ffffff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #cbd5e1;text-align\:center;">\<b>7\</b>\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Memory tiers with scope and validity\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Most subtle, benefits most from the rest\</td>\<td style="padding:10px 14px;border:1px solid #cbd5e1;">Corrections are scoped, not global\</td>\</tr> \</tbody> \</table> 

If you want a scorecard, score each of the following zero, one or two, with no partial credit for intent.

Every mutating tool accepts and receives an idempotency key. Unknown is a distinct outcome state and is never coerced. A recovering worker restores position without re-prompting the model. Guardrail skips are recorded, not just failures. Reducer, prompt, model and tool versions appear on every event. Each mutable fact has exactly one writer, or a stated conflict resolution model. Cost is reported per resolved and per attempted outcome. The ledger has a retention policy and a deletion story. Irreversible effects per turn are bounded and enforced.

Fourteen or above describes a system that will survive a bad night. Below eight, the first two phases will pay for themselves quickly.

---

## 13. What is established, and what I am proposing

Presentation can imply evidence that does not exist, so here is the ledger for the article itself.

 \<table style="width:100%;border-collapse\:collapse;box-shadow:0 2px 10px rgba(0,0,0,0.14);margin:22px 0;font-size:15px;"> \<thead> \<tr style="background:#1e293b;color:#f8fafc;"> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Claim\</th> \<th style="padding:12px 14px;border:1px solid #475569;text-align\:left;">Status\</th> \</tr> \</thead> \<tbody> \<tr style="background:#dcfce7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #15803d;">Event sourcing reconstructs state from a durable log\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">Established\</td>\</tr> \<tr style="background:#dcfce7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #15803d;">You cannot atomically append locally and mutate externally\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">Established\</td>\</tr> \<tr style="background:#dcfce7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #15803d;">Provider side idempotency is the strongest defence for ambiguous effects\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">Established\</td>\</tr> \<tr style="background:#dcfce7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #15803d;">Prefix caching needs an unchanged prefix, with 41 to 80 percent measured savings\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">Established\</td>\</tr> \<tr style="background:#dcfce7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #15803d;">GenAI observability conventions exist and are in development status\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">Established\</td>\</tr> \<tr style="background:#dcfce7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #15803d;">Lamport clocks give partial ordering only\</td>\<td style="padding:10px 14px;border:1px solid #15803d;">Established\</td>\</tr> \<tr style="background:#dbeafe;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #1d4ed8;">Memory, observability, cost and resilience share one substrate\</td>\<td style="padding:10px 14px;border:1px solid #1d4ed8;">My thesis\</td>\</tr> \<tr style="background:#dbeafe;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #1d4ed8;">The ten event vocabulary\</td>\<td style="padding:10px 14px;border:1px solid #1d4ed8;">My proposal\</td>\</tr> \<tr style="background:#dbeafe;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #1d4ed8;">One turn equals one trace anchor\</td>\<td style="padding:10px 14px;border:1px solid #1d4ed8;">Design recommendation\</td>\</tr> \<tr style="background:#fef3c7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #b45309;">Young and Daly applied to agent orchestration\</td>\<td style="padding:10px 14px;border:1px solid #b45309;">Heuristic transfer\</td>\</tr> \<tr style="background:#fef3c7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #b45309;">Greedy value density for context selection\</td>\<td style="padding:10px 14px;border:1px solid #b45309;">Approximation\</td>\</tr> \<tr style="background:#fef3c7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #b45309;">Scoring weights of 0.45, 0.20, 0.30, 0.15\</td>\<td style="padding:10px 14px;border:1px solid #b45309;">Illustrative only\</td>\</tr> \<tr style="background:#fef3c7;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #b45309;">2.31 times cost from a broken prefix\</td>\<td style="padding:10px 14px;border:1px solid #b45309;">Correct arithmetic, configuration specific\</td>\</tr> \<tr style="background:#f3e8ff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #7e22ce;">Entropy plus a progress term predicts loops\</td>\<td style="padding:10px 14px;border:1px solid #7e22ce;">Unverified hypothesis\</td>\</tr> \<tr style="background:#f3e8ff;color:#0f172a;">\<td style="padding:10px 14px;border:1px solid #7e22ce;">Better guardrail errors reduce retry cost\</td>\<td style="padding:10px 14px;border:1px solid #7e22ce;">Unmeasured, my emphasis\</td>\</tr> \</tbody> \</table> 

None of the primitives here are novel. The synthesis is the contribution, and a synthesis is a claim about organisation rather than discovery.

---

## References

**Event sourcing and state**

Martin Fowler, *Event Sourcing* and *Focusing on Events*, martinfowler.com. Also *What do you mean by event driven?*, on the limits of replay when external dependencies are involved.

**Distributed systems**

Leslie Lamport, *Time, Clocks, and the Ordering of Events in a Distributed System*, Communications of the ACM 21(7), 1978.

Stripe, *Idempotent Requests*, docs.stripe.com. The canonical treatment of indeterminate outcomes.

**Checkpointing**

J. W. Young, 1974, and J. T. Daly, 2006, on optimal checkpoint interval. See also *A survey on checkpointing strategies: should we always checkpoint à la Young/Daly?* for where the assumptions break down.

**Observability**

OpenTelemetry GenAI Semantic Conventions, github.com/open-telemetry/semantic-conventions-genai. Note the development status and the sensitive data warnings in the attribute registry.

**Cost**

*Don't Break the Cache: An Evaluation of Prompt Caching for Long-Horizon Agentic Tasks*, arXiv:2601.06007, 2026. Provider caching documentation should be checked directly, since rates change.

**Prior work on the harness framing**

Vishal Mysore, *Harness Engineering for AI Agents in 2026*. Divy Yadav, *Harness Engineering Explained*. Debmalya Biswas, *Observability for the Agentic Harness*.
