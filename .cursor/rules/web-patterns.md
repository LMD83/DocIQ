---
description: Patterns for apps/web UI work
globs:
  - apps/web/**
---

# apps/web patterns

## Directory convention

```
apps/web/
├── app/<route>/page.tsx      # the Next.js App Router page
├── components/
│   ├── ui/*                  # shared primitives (Button, Badge, Kbd, …) — NEVER fork
│   ├── layout/*              # cross-surface shell (top bar, sidebars)
│   └── <feature>/*           # feature components, no barrels
├── lib/
│   ├── utils.ts              # cn(), formatBytes(), clamp()
│   └── <feature>-store.ts    # Zustand when state spans components
└── hooks/                    # generic hooks (useKeyboardShortcut, …)
```

## Live-state pattern (the UX signature)

When adding a feature that does async work, model it like
`lib/upload-store.ts`:

1. **Explicit state machine per item** — e.g. `queued → hashing →
   extracting → scoring → routing → filed/review/quarantine`. Render the
   current state as a pulsing chip (`<StateBadge>`).
2. **Rolling event log** — an array of `{ id, t, kind, message, tone }`
   per item, displayed in mono font with timestamps. Events append as
   work happens.
3. **Progress bar** with a `shimmer-bg` overlay while in-flight,
   solid when terminal.
4. **Live numeric tick** — e.g. credibility score ticks up with ease-out
   cubic during scoring, settles at the final value.
5. **Final destination** rendered in mono at terminal state — the user
   sees exactly where the work went.

No generic `<Spinner />`. The user must be able to see what is happening.

## Tokens (tailwind.config.ts)

Use these, not hard-coded colors:

| Surface                 | Token                  |
|-------------------------|------------------------|
| Base background         | `bg-base`              |
| Card / input            | `bg-surface`           |
| Elevated (popover)      | `bg-surface-elevated`  |
| Default border          | `border-line`          |
| Stronger border         | `border-line-strong`   |
| Primary text            | `text-fg`              |
| Secondary text          | `text-fg-muted`        |
| Caption / label         | `text-fg-subtle`       |
| Dim                     | `text-fg-dim`          |
| Accent (primary action) | `bg-accent / text-accent` |
| Success / Filed         | `bg-success / text-success` |
| Warning / Review        | `bg-warning / text-warning` |
| Danger / Quarantine     | `bg-danger / text-danger`   |

Subtle tonal backgrounds: `bg-accent-subtle`, `bg-success-subtle`, etc.

## Motion

- Page transitions: none (instant feel).
- Element enter: Framer `initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}`
  with `transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}`.
- Drag-hover on drop zones: Framer spring, `stiffness: 300, damping: 20`.
- Hover states: 150ms CSS transition.
- **Never** use `transition-all` at default duration; pick a specific
  property or use `duration-150` / `duration-200`.

## Keyboard-first

Every primary action should have a shortcut:
- Submit / fire batch → `Enter` (when no input is focused)
- Open file picker → `⌘/Ctrl + O`
- Command palette → `⌘/Ctrl + K` (TODO)
- Close / cancel → `Esc`

Use the `useKeyboardShortcut` hook. Show the key on the button with `<Kbd>`.

## Imports

- `@/...` → `apps/web/*`
- `@neis/...` → `convex/docroute/neis/*` (the real NEIS parser — classification here is authoritative)
