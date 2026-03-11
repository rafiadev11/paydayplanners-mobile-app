# PaydayPlanners Mobile App

Expo bootstrap for the PaydayPlanners React Native app.

## What mirrors PowerMyFitness

- `expo-router` entrypoint and file-based screens
- Per-platform API env vars for iOS simulator and Android emulator
- `npm run dev`, `npm run prod`, and `npm run env` endpoint switching
- Bearer-token auth against Laravel `/api/v1/...` routes

## First-time setup

```bash
cd /Users/rachidrafia/Apps/PaydayPlanner/paydayplanners-mobile-app
npm install
npm run dev
```

Start the backend in a separate terminal:

```bash
cd /Users/rachidrafia/Apps/PaydayPlanner/paydayplanners
```

Serve it with your normal local setup so it is reachable at `http://localhost/`.

Start Expo:

```bash
cd /Users/rachidrafia/Apps/PaydayPlanner/paydayplanners-mobile-app
npm run start
```

Optional platform shortcuts:

```bash
npm run ios
npm run android
```

## Environment workflow

- `npm run dev` writes local simulator or emulator URLs into `.env.local`
- `npm run prod` copies production URLs from `.env.production.local`
- `npm run env` prints the current values

Update `.env.production.local` before any preview or production build.

## Quality gates

```bash
npm run lint
npm run typecheck
npm run expo:config:check
```
