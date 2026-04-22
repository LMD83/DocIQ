# `apps/web` — DocRoute UI staging app

Next.js 15 app that stages the DocRoute UI before it merges into the GovIQ
root Next.js app. Treated as the design-spec implementation: when you're
happy with how a surface looks and behaves here, port its components into
the GovIQ app.

**Aesthetic target:** Raycast-influenced dark UI — near-black surfaces,
single cool-blue accent, Geist Sans + Geist Mono, subtle motion, live state
over black-box spinners.

## Run it

```bash
cd apps/web
npm install
npm run dev
# -> http://localhost:3001 (redirects to /upload)
```

Port is fixed at **3001** so this app can run alongside another Next.js app
on 3000. Change via `next dev -p <port>` if needed.

Nothing else to set up — the upload surface uses a mock pipeline that runs
entirely client-side, simulating the five-stage DocRoute ingest flow with
realistic timing and plausible extraction signals.

The **real** NEIS parser runs unchanged (`@neis/*` path alias → 
`convex/docroute/neis/`). Drop an actual NEIS-compliant filename into the
zone and you'll see full / min / legacy classification happen against the
authoritative regex.

## What's built (upload surface)

- **Drop zone** — hero when empty, collapses to a compact strip once files
  are present. Drag-hover lifts + glows via Framer spring.
- **File row** — live state machine per file (`queued → hashing → extracting
  → scoring → routing → filed/review/quarantine`), expandable pane showing:
  - Full pipeline event log with tonal colouring (success/warning/info)
  - Extracted field pills (project, originator, author_firm, cert numbers,
    regulatory references)
  - SHA256 fragment
  - Final canonical destination path (mono font)
- **Batch summary** — sticky glass bar with live counts: NEIS full/min/legacy
  at parse time, filed/review/quarantine at terminal state.
- **Live credibility counter** — ticks up with an ease-out curve during
  scoring; green/amber/red at terminal state.
- **Keyboard shortcuts** — ⌘O to open file picker, ⏎ to file the batch.

## What's intentionally mocked

- The upload never hits a real server. The pipeline is simulated in
  `lib/upload-store.ts` with `setTimeout`-based staging so users see the
  work happening in real time.
- Extracted fields (author firm, certifier, cert numbers) are deterministic
  from the filename hash but not pulled from the actual document bytes.
- SHA256 is faked from the filename hash.

When this merges into GovIQ, `useUploadStore.startUpload` points at the real
Convex ingest action — the UI code stays identical.

## File layout

```
apps/web/
├── app/
│   ├── layout.tsx              # root layout + Geist fonts
│   ├── page.tsx                # redirects to /upload
│   ├── globals.css             # Tailwind + design tokens
│   └── upload/page.tsx         # the upload surface
├── components/
│   ├── layout/top-bar.tsx
│   ├── ui/                     # Button, Badge, Kbd primitives
│   └── upload/
│       ├── drop-zone.tsx
│       ├── file-row.tsx
│       ├── batch-summary.tsx
│       └── validation-badge.tsx
├── hooks/use-keyboard-shortcut.ts
└── lib/
    ├── utils.ts                # cn(), formatBytes(), clamp()
    └── upload-store.ts         # Zustand store + pipeline simulator
```

## Design tokens (tailwind.config.ts)

| Token               | Value              | Notes                                     |
|---------------------|--------------------|-------------------------------------------|
| `bg-base`           | `#0a0a0b`          | Near-black with warm undertone            |
| `bg-surface`        | `#141416`          | Cards, inputs                             |
| `bg-surface-elevated` | `#1c1c1f`        | Icon wells, popovers                      |
| `border-line`       | `rgba(255,255,255,0.06)` | Default divider                     |
| `text-fg`           | `#fafafa`          | Primary                                   |
| `text-fg-muted`     | `#9a9aa0`          | Secondary                                 |
| `text-fg-subtle`    | `#6a6a70`          | Labels, captions                          |
| `bg-accent`         | `#4f8cff`          | CTAs, in-progress states                  |
| `bg-success`        | `#4ade80`          | Filed, high credibility                   |
| `bg-warning`        | `#fbbf24`          | Review queue, min-match                   |
| `bg-danger`         | `#f87171`          | Quarantine, errors                        |

Rounded 12px (`rounded-card`), pill shape for badges (`rounded-pill`),
subtle `accent-glow` class for the hero drop zone on drag-hover.

## Adding a new surface

Follow the file-organisation pattern:
- `app/<surface>/page.tsx` — the page
- `components/<surface>/*.tsx` — feature components, no barrels
- `lib/<surface>-store.ts` — Zustand store when state lives across components
- Compose existing `components/ui/*` primitives — don't fork them

Before merging into GovIQ, replace the mocked store calls with real Convex
queries/actions and delete the simulation.
