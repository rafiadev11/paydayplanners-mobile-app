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

### Check simulator endpoints

Run this before testing backend-dependent flows, especially update prompts:

```bash
npm run env
```

Local simulator endpoints look like this:

```text
EXPO_PUBLIC_API_URL_IOS=http://paydayplanners.test
EXPO_PUBLIC_API_URL_ANDROID=http://paydayplanners.test
EXPO_PUBLIC_LEGAL_URL=http://paydayplanners.test
```

Use `npm run dev` for local endpoints and `npm run prod` for production endpoints. Restart Expo after switching so the simulator picks up the new env values.

## Release commands

Use OTA updates for changes compatible with the installed native runtime:

```bash
npm run ship:ios -- --ios-build=<installed-production-build-id> --message="Release description"
npm run ship:android -- --android-build=<installed-production-build-id> --message="Release description"
npm run ship -- --ios-build=<installed-ios-build-id> --android-build=<installed-android-build-id>
```

`ship` checks each supplied build's project, platform, production channel, store
status, runtime version, and native fingerprint against the local project using
EAS's production environment. Both platforms must pass before an `all` update is
published. Missing metadata or a mismatch blocks publishing; it never silently
starts a paid native build. Use the EAS build IDs of the versions actually
released to users, not merely the latest completed builds.

Native code, dependencies, permissions, or native configuration changes require
a new runtime and store build. With the `appVersion` runtime policy, increment
the app version for these changes, then explicitly request the native build:

```bash
npm run version:set -- 1.1.6
npm run ship:ios -- --native
npm run ship:android -- --native
```

`version:set` updates `app.json`, `package.json`, and `package-lock.json` together.
All `ship` commands run `version:check`. Explicit native shipping retains the
existing EAS Submit configuration. Preview and explicit `build:*` commands remain
available. The lower-level `ota:*` commands also remain available, but do not run
the compatibility preflight; prefer `ship` for production releases.

Run `node --test scripts/ship.test.cjs` to verify the release guards without
contacting EAS or publishing anything.

### Android release optimisation

`expo-build-properties` enables R8 minification and resource shrinking for phone
release builds. `plugins/with-android-optimization.cjs` selects the optimising
ProGuard defaults during prebuild; keep these settings in Expo configuration,
because `android/` is generated and ignored by Git.

The additional keep rule preserves Expo's runtime Record annotations. Without
it, R8 can optimise away annotation-backed field descriptors and break
SecureStore argument conversion during sign-in (Expo issue
https://github.com/expo/expo/issues/49081). Keep optimisation enabled and retain
this narrow exception until an upstream fix is verified in a release build.

Keep Expo notification classes implementing `Serializable` as well: scheduled
notifications are persisted using Java serialization. Their class/field names,
serial version IDs and private serialization hooks must survive R8 and remain
stable across upgrades. Without these hooks, scheduling notification data fails
with `NotSerializableException: org.json.JSONObject`.

After changing optimisation settings, build and smoke-test a release (startup,
sign-in, secure storage, notifications, and watch pairing). Check the generated
`android/app/build/outputs/mapping/release/` reports and the new bundle's DEX
scores in Play Console. These changes require a new native build and version code;
an OTA update cannot change a bundle already under review. Local Gradle builds
use the generated debug signing configuration and are for validation only;
use the production EAS build profile for a store submission.
When testing a local release against production, explicitly set
`EXPO_PUBLIC_API_URL_ANDROID=https://paydayplanners.com` so `.env.local` does not
direct the APK to the development server.

## Quality gates

`npm test` runs the portable TypeScript unit suite. The native calendar layout
regression compiles the Yoga sources bundled with React Native and requires a
`c++` compiler supporting C++20 (Xcode Command Line Tools on macOS, or GCC/Clang
on Linux). CI runs both suites; neither needs additional npm dependencies.

```bash
npm test
npm run test:calendar-layout
npm run lint
npm run typecheck
npm run expo:config:check
```
