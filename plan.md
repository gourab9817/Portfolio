# Blog subdomain: markdown → auto-published via GitHub Pages, no backend, no terminal

## Context

The portfolio (`gourabchoudhury.dev`) is a plain static site (no build step, no `package.json`) deployed to **Vercel**, with DNS managed at **name.com** (confirmed via `dig`). No `blogs` subdomain exists yet.

Goal, as refined across this conversation: write a markdown file, have it show up as a categorized post on `blogs.gourabchoudhury.dev` — no server to run, no local terminal, one repo (not a second repo, not a branch). Decisions locked in:

- **Everything stays in the existing `Portfolio` repo.** A branch was considered and rejected — it buys no isolation over a folder and creates constant divergence from `main`. A second repo was also considered and rejected by the user in favor of keeping one repo.
- **Hosting: GitHub Pages**, not a second Vercel project — the user wants the whole pipeline (source → build → hosting) inside GitHub itself. **This requires the repo to be public** (verified: it's currently private, and private-repo Pages needs paid GitHub Pro). The user chose to make the repo public over paying for Pro. I checked repo history for secrets/credentials first (`git grep` for key/token patterns, filenames) — clean, safe to flip.
- **No terminal, ever, for daily posting.** GitHub's web UI ("Add file" / "Upload files") and the GitHub mobile app commit directly from the browser/phone — no local git needed. That commit triggers a GitHub Actions build automatically.
- **Categories, open-ended.** Posts fall into categories (AI, Tools, Tech, New Launch, ...) that aren't a fixed enum — the user needs to be able to introduce a new category just by uploading into a new folder, with zero code changes.
- Confirmed earlier in this conversation: markdown→HTML via a **small custom Node script** (not Eleventy/Astro), and v1 includes **RSS, syntax highlighting, and tags** (tags are a secondary, optional cross-cutting label; category is the primary grouping).

The "no backend" trick is the same as before, just on a different free platform: the markdown build runs as a **GitHub Actions job** (ephemeral, free for public repos), and the output is static files served by **GitHub Pages** — nothing is ever "running."

## Architecture

**Same repo, new folders, GitHub Actions builds it, GitHub Pages serves it:**

```
Portfolio (repo, made public)
├── index.html, styles.css, script.js, work/, projects/, notes/, ...     ← existing site (untouched, still on Vercel)
│
├── blog/
│   ├── content/
│   │   ├── ai/                            ← category = folder name
│   │   │   └── rag-pipelines-in-prod.md
│   │   ├── tech/
│   │   │   └── why-http3-matters.md
│   │   ├── tools/
│   │   └── new-launch/                    ← a brand-new category folder just works, no config needed
│   ├── build/
│   │   ├── build.js                       ← md → static HTML
│   │   └── templates.js                   ← HTML shell reusing the portfolio's header/nav/footer markup
│   ├── public/                            ← BUILD OUTPUT, gitignored
│   └── package.json                       ← deps: gray-matter, markdown-it, highlight.js
│
└── .github/workflows/deploy-blog.yml      ← builds blog/ and deploys to GitHub Pages on every push
```

**Why folders-as-categories, not a `category:` frontmatter field**: it matches exactly how the user described the workflow — "upload the docs in the desired category" — you literally upload into `blog/content/<category>/`. No YAML field to type correctly, no risk of typo-ing "AI" three different ways across posts. GitHub's web "Create new file" lets you type a path like `new-launch/my-post.md` directly, which creates the folder on the spot — so adding a category is just as zero-friction as adding a post.

**CSS/JS stay in sync for free**: since this is the same repo now (not a separate one), `build.js` just copies `styles.css` / `script.js` / the favicon from the repo root into `blog/public/` at build time via `fs.copyFileSync` — no network fetch, no duplication, always current.

- **Vercel project (existing)**: untouched, keeps serving `gourabchoudhury.dev` / `www` exactly as today.
- **GitHub Pages (new)**: Settings → Pages → Source = "GitHub Actions" (not branch-based, since we need a build step). Custom domain = `blogs.gourabchoudhury.dev`.

## The build script (`blog/build/build.js`)

1. Walk `blog/content/<category>/*.md` — the immediate parent folder name is the category slug (`ai`, `tech`, `tools`, `new-launch`, ...), discovered dynamically by scanning the directory tree, never hardcoded.
2. Parse each post's frontmatter with `gray-matter`: `title`, `date` (`YYYY-MM-DD`), `description`, optional `tags: [..]`, optional `draft: true`.
3. Convert body with `markdown-it`, `highlight` hook wired to `highlight.js` for build-time syntax highlighting (static HTML+CSS, no client JS added).
4. Skip `draft: true` posts (commit a WIP post without it going live until you flip the flag).
5. A small `CATEGORY_LABELS` map gives known slugs nice display casing (`ai` → "AI", `new-launch` → "New Launch"); any slug not in the map falls back to auto Title Case — so an unrecognized new folder still renders sensibly with zero code changes.
6. Generate:
   - `public/index.html` — every post across all categories, newest first, each tagged with a category badge linking to that category's page (reuses the site's existing `.article-list` / `.page-head` CSS classes).
   - `public/<category>/index.html` — posts in just that category.
   - `public/<category>/<slug>/index.html` — the post itself, via a `postTemplate()` in `templates.js` that reuses the exact header/nav/footer markup from `notes/index.html`, nav pointing back to the main site via absolute URLs.
   - `public/categories/index.html` — index of every category currently in use with post counts (derived purely from folders present, so it never goes stale or needs manual updates).
   - `public/tags/<tag>/index.html` — for any post that used the optional `tags` field.
   - `public/feed.xml` — hand-rolled RSS 2.0 (all posts; per-category feeds are an easy later add using the same code path).
   - `public/CNAME` — must contain `blogs.gourabchoudhury.dev`. GitHub Pages needs this file *in the deployed artifact itself* when the source is "GitHub Actions" (unlike branch-based Pages, it won't inject this for you).

## GitHub Actions workflow (`.github/workflows/deploy-blog.yml`)

- Trigger: `push` to `main`, scoped to `paths: ['blog/**']` — so editing the portfolio doesn't rebuild the blog and vice versa.
- Steps: checkout → setup-node → `npm ci` (in `blog/`) → `npm run build` → `actions/upload-pages-artifact` (path `blog/public`) → `actions/deploy-pages`.
- Free for public repos, no minutes concern for a daily post.

## Daily workflow (no terminal, no coding editor)

1. Open the `Portfolio` repo on GitHub (web or the GitHub mobile app) → navigate to `blog/content/<category>/` (existing category) or type a brand-new folder name if it's a new one.
2. "Add file → Create new file" (type/paste the post) or "Upload files" (drag a `.md` written elsewhere, e.g. in Notes/Obsidian) → commit straight to `main`.
3. GitHub Actions builds and deploys automatically; `blogs.gourabchoudhury.dev` is live with the new post roughly a minute later.

## One-time manual setup (I can drive the repo-side pieces; the GitHub/DNS dashboard steps are yours to click through, and I'll walk you through each when we get there)

1. Confirm you want the repo flipped public (I verified no secrets are in the tracked history) — this is the one hard-to-reverse-feeling step, so it happens only on your explicit go-ahead, not automatically as part of building this out.
2. GitHub repo Settings → Pages → Source: "GitHub Actions".
3. GitHub repo Settings → Pages → Custom domain: `blogs.gourabchoudhury.dev` → Enforce HTTPS once verified.
4. name.com DNS panel → add `CNAME` record: host `blogs` → `gourab9817.github.io`.

## Optional follow-up (not v1, flagged for later)

- Add a "blog" link to the main site's nav pointing at `https://blogs.gourabchoudhury.dev/` — touches the repeated `nav-links` block across `index.html`, `work/index.html`, `projects/index.html`, `notes/index.html`, `resume/index.html`, `contact/index.html`, and `projects/*.html` (same pattern each time, e.g. `notes/index.html:11`).
- **Decap CMS** as a nicer-than-raw-markdown authoring UI (a real "New Post" form with a category dropdown, live preview) — purely additive on top of this exact structure, needs a small one-time GitHub OAuth handshake. Not needed for v1 since GitHub's own web upload already meets the "no terminal" bar.

## Verification

1. `cd blog && npm install && npm run build` — confirm `public/` has `index.html`, `categories/index.html`, at least one `public/<category>/<slug>/index.html`, `public/CNAME` with the right domain, and `feed.xml`.
2. Serve `public/` locally and check: post list, an individual post (syntax highlighting renders), a category page, the categories index, and that `feed.xml` parses as valid XML.
3. Confirm visual parity with the existing site (nav, fonts, colors, mobile nav toggle) next to e.g. `notes/index.html`.
4. Push a real commit to a brand-new category folder → confirm the Actions run goes green and the new category page appears live on `blogs.gourabchoudhury.dev` with no manual step beyond the commit.
