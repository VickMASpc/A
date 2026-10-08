# Project guidance

## Core product constraints

- This is a personal, single-user app.
- Design mobile-first, especially for 360–430 px widths.
- Sessions should support focused 5–10 minute study.
- Do not add AI conversation features.
- Gamification must remain quiet and non-intrusive.
- Keep curriculum/content separate from the UI.
- Firebase is the backend integration target; GitHub Pages hosts the frontend.
- Tests are required for behavior changes.
- Curriculum/content validation is required when content is added or changed.
- Never publicly expose Firestore writes. Use authenticated, security-rule-protected access.

## Autonomous Codex runs

When work is being performed by a recurring/autonomous Codex workflow:

1. Read `CODEX_AUTONOMY.md` before selecting work.
2. Read `AUTONOMOUS_STATE.md` before selecting work.
3. Continue the current milestone instead of inventing a new roadmap.
4. Make one coherent product-facing slice per run.
5. Update `AUTONOMOUS_STATE.md` before finishing the run.
6. Commit successful autonomous work with a message beginning `auto(jp):`.
7. Use the long-lived `codex/autonomous` branch unless the user explicitly changes the branch strategy.

The autonomous goal explicitly forbids architecture rewrites, AI tutor/chat features, punitive gamification, and cycles dominated by speculative infrastructure.

## Development checks

Run all of these before handing off or committing a successful autonomous cycle:

- `npm run content:validate`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
