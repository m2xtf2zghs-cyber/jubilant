# Jubilant (Capacitor iOS/Android)

This folder is a starter scaffold to turn the Jubilant/LIRAS dashboard into an offline mobile app using:

- Vite + React + Tailwind (offline web bundle in `dist/`)
- Capacitor (native wrapper for iOS/Android)

## Prereqs

- Node.js 20+
- Xcode (for iOS)
- CocoaPods (`brew install cocoapods`)
- Android Studio (for Android)

## Dev (Web)

```bash
cd jubilant
npm install
npm run dev
```

## Build + iOS

```bash
cd jubilant
npm install
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode: set Signing Team, then Run.

## Build + Android

```bash
cd jubilant
npm install
npm run build
npx cap sync android
npx cap open android
```

In Android Studio: let Gradle sync, then Run.

## Offline Notes

For true offline use, avoid CDN/script imports inside the app. Bundle all JS/CSS via Vite.

## Statement Autopilot Backend (FastAPI)

A backend parser/export service is included at:

- `/Users/jegannathan/Documents/New project/jubilant/statement_service`

Use it for strict parsing + reconciliation + template-clone Excel generation.
Setup/run details are documented in:

- `/Users/jegannathan/Documents/New project/jubilant/statement_service/README.md`
