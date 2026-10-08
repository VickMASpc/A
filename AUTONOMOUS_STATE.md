# Autonomous development state

Last updated: 2026-10-04

## Branch strategy

Autonomous work should continue on `codex/autonomous` unless the user explicitly changes the strategy.

Keep commits small enough to inspect but large enough to deliver a real slice. Do not create a new branch for every hourly run.

## Current milestone

M1 — Daily Study Loop

## Repository state at autonomy setup

The app currently has:
- working authentication and signed-in application shell
- Today shell with a link into Learn
- Learn rendering the first seed lesson
- working multi-format exercise engine/player
- Firestore-backed item progress, lesson progress, and exercise attempts
- `nextReviewAt` and basic mastery states in the progress model
- placeholder Review, Progress, and Settings screens
- one seed unit (`unit-n5-basics`) and one seed lesson (`lesson-first-words`)
- curriculum validation and content sync scripts
- project tests and build checks

Important limitation: `src/features/learn.js` currently selects `lessonData.items[0]`, so curriculum navigation does not yet exist.

## Next best slice

Build the first M1 domain/service layer before polishing the Today UI.

Recommended scope:
1. Define a testable daily-session model that can represent review items, lesson exercises, completion, and resume position.
2. Add Firestore persistence paths/service functions for a user's calendar-day session.
3. Add a deterministic session composer that accepts due progress/current curriculum inputs and returns a bounded 5–10 minute session plan.
4. Keep the first implementation modest: it may use current seed lesson material while exposing interfaces that later Review/curriculum work can feed.
5. Add focused tests.
6. Wire enough of Today to create/load/resume the daily session if the domain layer is stable within the same run.

Do not build a large generalized scheduler framework.

## Verification required every successful run

- `npm run content:validate`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Run log

Add one compact entry per autonomous run:

### YYYY-MM-DD HH:MM — <short title>
- Changed:
- Verified:
- Remaining / next:
- Blockers: none
