# Jubilant Native (Android-first, Pure Native UI)

This is a **fresh** Kotlin Multiplatform + Android (Jetpack Compose) project with:

- 100% native Android UI (no WebView)
- Shared KMP data/sync layer (`:shared`)
- Supabase Auth (email/password) + cloud data (PostgREST)

This folder is **separate** from the existing `jubilant/` web + Capacitor app.

## Configure Supabase

Set these Gradle properties **locally** (do not commit secrets):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

You can find the anon key in Supabase Dashboard → **Project Settings** → **API** → **anon public**.

Option A (recommended): add them to `~/.gradle/gradle.properties`:

```properties
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Option B (project-local, easier): copy `supabase.properties.example` → `supabase.properties` and fill it in.
`supabase.properties` is gitignored.

## Run (Android)

Open `jubilant-native/` in Android Studio and run the `androidApp` configuration.

Prereqs:
- Android Studio (includes a compatible Java runtime)
- Android SDK installed via Android Studio

CLI (if you have Android SDK configured):

```bash
cd jubilant-native
./gradlew :androidApp:installDebug
```

## Modules

- `:shared` – Kotlin Multiplatform (network/auth/data access)
- `:androidApp` – Android app (Compose UI)

## Underwriting (Hardcoded Rule Engine)

The app includes a deterministic **Hardcoded Underwriting** workflow:

- Pick a lead → upload bank statement PDF(s) → parse → run the rule engine (offline) → optionally save to Supabase.
- Supabase schema + RLS policies are in `jubilant/UNDERWRITING_SETUP.sql` (run once in Supabase SQL editor).

Notes:
- The MVP PDF parser extracts **text** from PDFs. Scanned/image PDFs will not parse without OCR.
