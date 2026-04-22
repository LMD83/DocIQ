# Migrating from web chat to Claude Code

Step-by-step handoff for GovIQ DocRoute. Follow in order. Total time: ~30 minutes if the prerequisites are already in place.

---

## Prerequisites

You need these installed on your machine before starting:

- **Node.js 20+** (`node -v` to check; install via nvm if missing)
- **npm or pnpm**
- **Git** and a GitHub account
- **Claude Code** — install with `npm install -g @anthropic-ai/claude-code` (requires an Anthropic account; log in with `claude` once installed)

Optional but useful:
- **Convex CLI** (installs with `npm install` in the repo)
- **gh** (GitHub CLI) for one-command repo creation

You need accounts for:
- **GitHub** (for the repo)
- **Anthropic Console** (for the Claude API key — `console.anthropic.com`)
- **Convex** (`dashboard.convex.dev`)
- **Cloudflare** (free tier is fine to start — `dash.cloudflare.com`)
- **Vercel** when you're ready to deploy a frontend (not needed for the first Claude Code session)

---

## Step 1 — Extract the scaffold

Download `goviq-docroute-scaffold.zip` (the bundle from the previous message) to your machine and extract it to wherever you keep code. I'll assume `~/code/goviq-docroute` below.

```bash
cd ~/code
unzip ~/Downloads/goviq-docroute-scaffold.zip
cd goviq-docroute
```

Verify the layout:

```bash
ls -la
# You should see: CLAUDE.md, README.md, package.json, tsconfig.json,
# .gitignore, .env.example, convex/, tests/, docs/, reference/
```

If any of those are missing, stop and re-download.

## Step 2 — Initialise git and push to GitHub

```bash
git init
git add .
git commit -m "Initial scaffold — schema, NEIS parser port, seeds, parity tests"

# If you have gh CLI:
gh repo create goviq-docroute --private --source=. --push

# Or create the repo manually on github.com then:
git remote add origin git@github.com:YOUR_USERNAME/goviq-docroute.git
git branch -M main
git push -u origin main
```

**Private repo. Not public.** This contains HSE convention details and the Estate Spine PRD — both are HSE intellectual property. Keep the repo private until you have explicit permission to publish anything.

## Step 3 — Install dependencies and verify the parity tests pass

```bash
npm install
npm run typecheck
npm test
```

Expected: all tests pass. If they don't, stop and flag it before Claude Code touches anything — the parity tests are the contract with `neis_parser.py` and they must be green before any new feature work.

## Step 4 — Create local env file

```bash
cp .env.example .env.local
```

Fill in at minimum:
- `ANTHROPIC_API_KEY` (from `console.anthropic.com`)
- Leave Convex blank for now — next step generates these

## Step 5 — Provision Convex

```bash
npx convex dev
```

This prompts you to log in the first time, creates a new project, generates `convex/_generated/`, and writes the `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` values. Choose **EU region** when prompted (this is important for HSE and the productisation brief's compliance story).

Leave `npx convex dev` running in its own terminal — it watches for schema changes and redeploys.

In a **second terminal**:

```bash
# Seed global conventions + originator registry
npm run seed:all
```

Expected output:
```
Seeded NEIS: created (jh...)
Seeded ISO 19650: created (jh...)
Originator registry: 5 created, 0 updated
```

## Step 6 — Start Claude Code

From the repo root:

```bash
claude
```

First thing it does: reads `CLAUDE.md`. This loads every decision, constraint, and standard we set in web chat. You don't need to re-explain any of it.

Verify it picked up the context with a first low-stakes prompt:

```
What's built in this repo, what's not, and what's the next priority?
```

If the answer matches §5 and §6 of CLAUDE.md, the handoff worked. If it doesn't, check that `CLAUDE.md` is in the repo root (not in a subfolder) and restart `claude`.

---

## First three sessions — suggested prompts

Paste these as-is. They're framed to match what's in §6 of `CLAUDE.md`.

### Session 1 — Document ingest pipeline (biggest-leverage piece)

```
Build the document ingest pipeline described in CLAUDE.md §6 point 1.

Requirements:
- HTTP action in convex/documents.ts that accepts an upload for a given project
- Stores the file in Convex file storage (we'll add the adapter pattern in session 2 — don't do it here)
- Computes SHA256; dedupes against `by_project_sha` index on the documents table
- Runs the TS parser from convex/neis/parser.ts on the filename
- Triggers an internal action that:
    - Loads the convention for the project
    - Extracts text from PDF (pdf-parse), DOCX (mammoth), XLSX (SheetJS) based on mime
    - Calls Claude via Anthropic SDK with structured output; schema is derived from convention.fields
    - Uses sha256 as cache key to skip re-extraction
    - Computes per-field confidence, runs scoringFromParser + recordCredibility
    - Sets document.status and writes extracted fields
    - Emits auditEvents at: uploaded, extracted, scored, routed
- Respects the licence status when a student watermark is detected (-0.15 penalty)
- p95 < 30s per file per CLAUDE.md §7

Use Anthropic SDK v0.x; pin the version. Write unit tests for the dedupe path
and the confidence-map translation. Don't touch the storage adapter interface 
yet — hardcode Convex file storage for this session.

Start by writing a short plan for my review before any code.
```

### Session 2 — Storage adapter interface

```
Implement the storage adapter interface per CLAUDE.md §3 (D3) and 
docs/03-storage-brief.md §3.

Requirements:
- Abstract StorageAdapter interface with put, get, delete, getUrl
- ConvexStorageAdapter (current default for SaaS tenants)
- R2Adapter (Cloudflare R2 with EU jurisdiction lock; use aws-sdk v3 
  s3 client pointed at R2 endpoint)
- SmbAdapter (stub only; mark as TODO — HSE pilot will use this but 
  we don't have SMB credentials yet)
- Adapter selected per project via a projects.storageAdapter field 
  (add to schema)
- Update documents.ts from session 1 to use the adapter instead of 
  hardcoded Convex file storage
- Config read from env; env keys match .env.example

Do not write the SMB adapter implementation — just the interface and a 
NotImplementedError stub. Write integration tests for ConvexStorageAdapter 
and R2Adapter. Plan first, code after my review.
```

### Session 3 — Upload UI (first user-visible surface)

```
Next.js 15 upload page per CLAUDE.md §6 point 3.

Requirements:
- New Next.js app under app/ using the App Router
- Page at /projects/[projectId]/upload
- Drag-and-drop zone + file input; single and bulk (max 500 files, 2GB batch)
- For each file in the drop: immediately run parseFilename from 
  convex/neis/parser.ts client-side and show the pattern matched 
  (full / min / none) with a green/amber/red indicator
- On submit: upload each file via the action built in session 1
- Stream status updates via Convex subscription on the documents table
- Use shadcn/ui components (read mnt/skills/public/frontend-design/SKILL.md 
  first if the skill is available; otherwise stick to clean Tailwind)
- Mobile-responsive

Do not build the review queue UI yet — that's session 4. Just upload + 
live status. Plan first.
```

---

## Ongoing workflow

### When to use Claude Code vs when to come back to chat

**Claude Code is right for:**
- Writing new modules and features
- Fixing bugs and running tests
- Refactoring
- Dependency upgrades and migrations
- Anything that touches multiple files and needs to run the code

**Come back to chat for:**
- Strategic decisions you want me to push back on
- New PRDs or architectural briefs
- Commercial / pricing exercises (like the HSE commercial model)
- Multi-stakeholder framing (investor deck, HSE procurement pack, customer sales assets)
- Second-opinion reviews of Claude Code's work

Claude Code updates `docs/` locally as it builds. When it finishes a significant piece of work, commit, push, and come back to chat with a link to the repo if you want a strategic review of where things stand.

### Updating CLAUDE.md

Keep it current. Every time a decision moves from "open" to "locked," edit §2 of `CLAUDE.md` and commit the change. Every time a piece of work completes, move it from §6 to §5. A stale CLAUDE.md rots the whole handoff.

### Skills (optional, advanced)

Claude Code supports skills — reusable prompt packs that load on demand. If you find yourself repeating the same instructions ("always validate tenant access before any query"), lift them into a skill under `.claude/skills/`. Not needed for the first few sessions.

### Secrets discipline

- `.env.local` never leaves your laptop
- `npx convex env set KEY value` for secrets the Convex runtime needs
- Vercel environment variables for frontend deployments
- Never paste API keys into Claude Code prompts — it uses them via env reads, not prompt text
- Rotate any key that accidentally enters a prompt or commit

---

## If something goes wrong

- **`npm test` fails after a Claude Code session:** the parity fixtures broke. Don't merge. `git diff` against main and check whether `convex/neis/regex.ts`, `parser.ts`, `normalise.ts`, or `credibility.ts` changed without an explicit reason. If it changed, roll back — those files are the Python-parity contract and should only change with a coordinated PR to `reference/neis_parser.py`.
- **`npx convex dev` won't start:** check you're logged in (`npx convex login`); check the deployment region is set.
- **Claude Code doesn't seem to have the context:** `CLAUDE.md` isn't being read. Must be at repo root, not in a subfolder. Also check file is named exactly `CLAUDE.md` (case-sensitive on Linux/macOS).
- **Auth errors from Anthropic API:** key isn't set, or isn't set in the right environment. For Convex actions it needs to be `npx convex env set ANTHROPIC_API_KEY ...`, not just in `.env.local`.

---

## Checklist — have I done everything?

- [ ] Scaffold extracted to local machine
- [ ] `git init` done; repo pushed to private GitHub
- [ ] `npm install` succeeded
- [ ] `npm test` passes (parity with Python parser)
- [ ] `.env.local` filled with Anthropic key
- [ ] `npx convex dev` running in a terminal
- [ ] `npm run seed:all` completed
- [ ] Cloudflare R2 bucket created with EU jurisdiction lock
- [ ] R2 credentials in `.env.local` (can wait until session 2)
- [ ] `claude` launched; confirmed CLAUDE.md was read
- [ ] First session prompt pasted; plan received and reviewed before any code

When every box is ticked you're in the new workflow. Web chat remains available for strategy and cross-cutting questions.
