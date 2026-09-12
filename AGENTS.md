# AGENTS.md — BeadLoom

Instructions for AI agents and humans working in this repository.

## Superpowers (required)

When **Superpowers** is available in the environment (plugin / skill pack), you **must** follow it: read and apply the relevant Superpowers skills for the task instead of improvising a one-off process.

Use the Superpowers pipeline as the default lifecycle:

1. **Clarify** — Resolve ambiguities with the user (or state explicit assumptions). Do not write production code until requirements and acceptance criteria are clear enough to verify.
2. **Isolate** — Use a dedicated branch or git worktree so experiments do not pollute the main line of development.
3. **Plan** — Break work into small, verifiable steps (files touched, order, risks). Treat the plan as disposable execution scaffolding, not the contract of correctness.
4. **Implement** — Prefer subagent-driven or focused sessions for large changes when Superpowers recommends it, to limit context bleed.
5. **TDD** — Where Superpowers prescribes test-driven development, follow red → green → refactor: failing test first, then minimal code to pass, then cleanup.
6. **Review** — Run the Superpowers review / checklist step before calling work done (spec fit, edge cases, regressions).
7. **Finish** — Merge or open a PR only after checks pass; leave the branch in a clean, documented state.

If Superpowers is not installed, still mirror this order manually: clarify → isolate → plan → implement with tests → self-review → finish.

## Spec is the contract

Humans and reviewers align on **spec** (behavior, acceptance criteria, boundaries, non-goals), not on the agent’s internal **plan**. The plan may change; the agreed spec must not be violated. When the user provides a spec, trace implementation and tests against it explicitly.

## Scope and edits

- Change only what the task requires. No drive-by refactors, unrelated formatting, or removal of comments not introduced by this task.
- Do not add or edit Markdown files (including this one) unless the user asks for them.

## Code style (project rules)

- Use **semantic English** names; keep only conventional abbreviations (e.g. `id`, `url`). No meaningless abbreviations, single-letter business names, or romanized non-English shortcuts.
- Prefer simple, readable code over cleverness. Do not extract helpers unless there is real reuse or a clearly separated core (roughly: avoid one-off extractions; consider extraction only when duplication is meaningful and repeated).
- Validate external input **once** at the boundary (API handlers, CLI args, file/schema parse). Avoid duplicated validation through internal call chains; guard only for genuine failure modes.
- Use `trim` only when leading/trailing whitespace is a real concern.
- In typed code, annotate types clearly; avoid `any`-style escape hatches. Do not cast without a justified type story; narrow with checks instead.

## Verification and hygiene

- Run the project’s tests, typecheck, or build commands when they exist. Do not claim completion without running what the repo provides (or adding the minimal harness if none exists and the task requires it).
- Remove debug noise: stray `console` logging, breakpoints, dead code, and obsolete comments before handoff.
- Commit messages: full sentences stating **what** changed and **why**, without filler.

## Communication

- When pointing at existing code, use the editor’s line-range citation format so others can jump to it.
- Explain behavior changes and rationale in plain language; avoid dumping identifiers without context.

---

If `README.md` documents install, test, and layout conventions, follow it wherever it is **more specific** than this file. If the repo root is still empty, confirm stack and add `README.md` before substantial implementation.