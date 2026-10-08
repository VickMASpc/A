# Japanese study

A personal, mobile-first Japanese-learning web app. This first milestone establishes the app shell and placeholder destinations for short, focused study sessions.

## Run locally

```sh
npm install
npm run dev
```

## Quality checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Structure

- `src/app` — application bootstrap and shell
- `src/components` — reusable UI components
- `src/features` — feature screens
- `src/curriculum` — learning content, deliberately independent from UI
- `src/firebase` — Firebase integration boundary
- `src/models` — shared domain models
- `src/utils` — generic utilities
- `src/styles` — global styles
- `tests` — app-shell behavior tests

## Deployment

`npm run build` produces `dist/`, which can be deployed as a GitHub Pages artifact. Vite uses relative asset paths so it works when served from a repository subpath.

## Firebase setup

1. Create a Firebase web app, enable Google as an Authentication sign-in provider, and add the GitHub Pages domain to Firebase Authentication's authorized domains.
2. Copy `.env.example` to `.env` and fill in the Firebase web configuration values. Vite exposes only variables prefixed with `VITE_`; this configuration is public by design and is protected by Firestore Security Rules.
3. Deploy [firestore.rules](C:/Users/VictorMonteiroDeArau/Documents/ChatGPT/JP%20app/firestore.rules) with the Firebase CLI or Console before using the app. The rules allow only an authenticated user to access `users/{uid}/**` for their own UID; all other client access, including curriculum/admin writes, is denied.

The app creates `users/{uid}` at the first successful authenticated session. Future private settings, progress, sessions, and lesson-progress data belong below that document.

## Curriculum content

Seed content is stored under `content/`, entirely separate from UI code. Validate it with:

```sh
npm run content:validate
```

### Syncing repository content to Firestore

Repository files under `content/` are the source of truth. First validate, then preview the Firebase diff:

```sh
npm run content:sync -- --dry-run
```

`content:sync` uses the Firebase Admin SDK and writes only creates or changed stable IDs to `curriculum/{type}/items/{id}`. It never deletes remote documents. A normal run needs either Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`) or a JSON service account supplied only at runtime through `FIREBASE_SERVICE_ACCOUNT_JSON`. Do not commit credentials, service-account key files, or CI secrets. In CI, store the service-account JSON in the platform secret store and expose it only to the protected sync job.

## Exercise and progress

The Learn screen renders the seed lesson exclusively from its content data. It supports multiple choice, Japanese→English, English→Japanese, fill-in-the-blank, typed-answer, sentence ordering, kanji-reading, and reading-comprehension exercises. Submitted attempts are written privately to:

- `users/{uid}/progress/{contentId}`
- `users/{uid}/lessonProgress/{lessonId}`
- `users/{uid}/exerciseAttempts/{timestamp-exerciseId}`

The UI reports saving failures and offers a retry; it never labels failed writes as saved.
