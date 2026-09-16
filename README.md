# OnMyMind

Personal to-do lists with a clean white UI and vibrant colored columns. Sign in with Google; data syncs via Firebase so it follows you across devices. Hosted on GitHub Pages.

**Live (after deploy):** https://josefberman.github.io/OnMyMind/

## Features

- Create named lists with a color of your choice
- Add, cross off, and delete items in each list
- Drag columns to reorder lists; drag items within a list to reorder
- Done items sink to the bottom of their column
- Google sign-in; only you can read or write your data

## Local development

### 1. Firebase project

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. **Authentication** → Sign-in method → enable **Google**
3. **Firestore Database** → create a database (production mode)
4. Paste the contents of [`firestore.rules`](firestore.rules) into Firestore → Rules → Publish
5. **Project settings** → Your apps → add a **Web** app and copy the config
6. Authentication → Settings → Authorized domains: add `localhost` and `josefberman.github.io`

### 2. Env file

```bash
cp .env.example .env.local
```

Fill in:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Run

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Repo **Settings → Secrets and variables → Actions**: add the same six `VITE_FIREBASE_*` values as repository secrets
2. **Settings → Pages**: Source = **GitHub Actions**
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually)

The workflow builds with those secrets and publishes `dist/` to Pages.

## Stack

- Vite + React + TypeScript
- Firebase Auth (Google) + Cloud Firestore
- @dnd-kit for drag-and-drop
- Custom CSS (Plus Jakarta Sans)

## License

Apache 2.0 — see [LICENSE](LICENSE).
