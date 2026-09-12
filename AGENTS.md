# AGENTS.md

Guidance for agents working in **BeadLoom** (豆织工坊). Install and scripts: [README.md](README.md). Next.js 16 in `apps/web`: follow [apps/web/AGENTS.md](apps/web/AGENTS.md) before writing Next APIs.

## Product shape

```text
Chat (Apeira + chart tools) ↔ Zustand store ↔ canvas HUD
 ↓
 @beadloom/core PatternDocument
 @beadloom/palettes defaultPalette
```

| Path | Role |
| --- | --- |
| `apps/web` | Shippable product (editor, chat agent, browser persistence) |
| `packages/core` | `PatternDocument` and drawing ops |
| `packages/palettes` | Bead colors |
| `packages/ui` | Shared UI primitives |

When a domain term crystallizes, or a durable choice is made, use **domain-modeling** — write `CONTEXT.md` / a numbered ADR; do not leave it only in chat. When a seam or module is designed, use **codebase-design**.

## Hard constraints

- API keys stay in in-app settings (`beadloom.llm` localStorage), never in the repo.
- Charts persist in this browser (`beadloom.patternLibrary`). No server store.
- Agent writes go through chart tools (`set_cells`, `draw_line`, `fill_area`) into `@beadloom/core`. Do not add a private write path.
- Library, size, palette picker, and undo stay human. Do not expose them as agent tools.
- Tool coordinates are 0-based `{column, row}`. Preview ticks are 1-based. Palette codes come from `@beadloom/palettes`; never invent codes.
- Semantic English names; conventional abbreviations only (`id`, `url`).
- Validate external input once at the boundary. Extract a helper only when reuse is real or a core is clearly separate.
- Change only what the task requires. Markdown only when asked.
- Spec is the contract: when the user provides a spec, trace implementation and tests against it. Design it twice and pick the cleaner design. No unsolicited docs.

## Skills

When the task matches, read the skill before acting — not a menu to skip.

- Seam or module design → `codebase-design`
- A domain term crystallizes, or a durable choice needs an ADR → `domain-modeling`
- Something is broken, throwing, or slow → `diagnosing-bugs`

## Commits

`type(scope): English subject` — e.g. `feat(web): …`, `fix(core): …`.

Commit only when asked. Preserve unrelated user changes already in the worktree.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (and `pnpm build` when the change can break the bundle). Prefer targeted checks over inventing large suites unless asked.
- After logic changes: deslop; use codebase-design language if a seam moved. After UI changes: exercise the flow in the browser.
- In typed code, annotate types; narrow with checks instead of `any` or unjustified casts.
