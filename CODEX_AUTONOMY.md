# Codex autonomous development goal

This file defines the persistent objective for autonomous Codex runs on JP-app.

## Product objective

Turn JP-app into a genuinely useful personal Japanese-learning application for long-term daily study.

The product is mobile-first (especially 360–430 px), optimized for focused 5–10 minute sessions, and intended to progress from beginner Japanese toward approximately N3/intermediate ability over time.

Priorities:
1. Reading
2. Listening
3. Kanji
4. Vocabulary and grammar
5. Speaking support only when it materially helps study

This is not a Duolingo clone, not an AI-chat product, and not a streak/XP game.

## Existing foundation — preserve it

Do not rebuild or replace the current architecture.

The existing repository already has:
- Vite frontend shell
- Firebase Google authentication
- authenticated per-user Firestore data
- repository-owned curriculum content under `content/`
- curriculum validation and Firebase content sync
- an exercise engine and exercise player
- persistent lesson, item, and attempt progress
- tests for auth, curriculum, exercises, progress, Firestore rules, shell, and sync behavior

Treat those systems as the foundation unless a concrete bug requires a focused change.

## Autonomous run contract

Every scheduled run must do the following:

1. Read `AGENTS.md`, this file, `AUTONOMOUS_STATE.md`, and relevant current source/tests before changing code.
2. Inspect the current repository state and previous autonomous commits. Never assume the state from an earlier prompt.
3. Select ONE coherent, highest-value product slice that advances the current milestone. A slice may be substantial, but it must end in a working state.
4. Prefer user-visible study functionality and real curriculum over infrastructure, abstractions, rewrites, docs, or test-harness expansion.
5. Implement the slice completely enough to be usable. Update tests and content validation when behavior/content changes.
6. Run the full project checks before considering the run complete:
   - `npm run content:validate`
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
7. Fix failures caused by the run. Do not commit a knowingly broken tree.
8. Update `AUTONOMOUS_STATE.md` with what changed, what was verified, and the next best slice.
9. Commit successful work with a concise message beginning `auto(jp):`.
10. Push the commit to the active autonomous branch when repository credentials allow it.

If a run encounters a blocker it cannot responsibly solve, do not invent credentials, external configuration, or user decisions. Record the blocker in `AUTONOMOUS_STATE.md` and stop cleanly.

## Development behavior

- Do not perform architecture rewrites.
- Do not replace working systems with speculative alternatives.
- Do not spend a cycle mostly on documentation, defensive abstractions, or future-proofing.
- Do not add AI conversation/tutor chat.
- Do not add punitive streak mechanics, noisy gamification, currencies, leagues, hearts, lives, or XP-first design.
- Do not turn the app into a generic language-learning template. It is specifically for Japanese.
- Do not hard-code UI around a single seed lesson when a curriculum-driven solution is appropriate.
- Keep curriculum/content independent from rendering code.
- Preserve authenticated Firestore boundaries.
- Avoid adding dependencies unless they materially simplify a current requirement.
- Keep touch targets, layout, and text readable on 360–430 px screens.
- Prefer deterministic behavior that can be tested.
- Use Japanese text naturally and correctly; do not manufacture dubious instructional content merely to increase volume.
- When expanding curriculum, prioritize coherence and prerequisite order over raw item count.

## Current milestone order

Work in this order unless repository evidence shows a prerequisite bug must be fixed first.

### M1 — Daily Study Loop

Make Today a real daily study surface.

Required end state:
- build a daily session from due review + current curriculum material
- cap workload to a humane 5–10 minute session
- persist the generated daily session so refresh/navigation does not reroll it
- resume an unfinished session
- record attempts through the existing progress model
- show a simple completion state
- no backlog punishment after missed days

### M2 — Review

Turn Review into a real spaced-review queue using existing item progress and `nextReviewAt`.

Required end state:
- due-item retrieval
- priority for weak/recently missed material
- a capped queue
- useful empty state
- completing review updates scheduling/progress

### M3 — Curriculum navigation

Replace the hard-coded first lesson experience with real unit/lesson navigation.

Required end state:
- units and lessons rendered from content
- lesson status/progress
- clear current/recommended lesson
- manual lesson selection remains possible
- prerequisite/ordering behavior is explicit and testable

### M4 — Furigana and study settings

Implement settings that affect actual learning.

Start with:
- furigana behavior: normal / hide for familiar kanji / reveal-on-tap where practical
- persist settings per user
- use settings in reading/lesson surfaces

### M5 — Progress

Make Progress calm but genuinely informative.

Include useful metrics such as:
- recent sessions/activity
- item mastery distribution
- recent accuracy
- curriculum position
- exposure by vocabulary/grammar/kanji/reading

Avoid gamified pressure.

### M6 — Real curriculum tranche

Expand beyond seed content into a coherent beginner course tranche large enough for repeated daily use.

Content should include meaningful reading and kanji early, not only isolated vocabulary drills. Add listening infrastructure/content when a reliable audio source or generation path exists; do not fake listening with text-only placeholders.

## Definition of done for an autonomous cycle

A cycle is successful when:
- it materially improves the study experience,
- changed behavior is covered by appropriate tests,
- content remains valid,
- all quality checks pass,
- the repository is left simpler or no harder to continue,
- and `AUTONOMOUS_STATE.md` tells the next run exactly where to continue.
