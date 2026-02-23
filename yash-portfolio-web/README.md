# Yash Portfolio Web (React + Vite)

React conversion of the finance portfolio manager prototype, now buildable and deployable on Netlify.

## Scripts
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Auth Modes (Web App)
- Copy `.env.example` to `.env`
- Choose one mode:
  - Backend mode (recommended): `VITE_API_BASE_URL` (+ optional `VITE_BACKEND_ORG_CODE`)
  - Demo mode (fallback): `VITE_DEMO_USERNAME`, `VITE_DEMO_PASSWORD`

Example:
```bash
cp .env.example .env
```

Backend mode (recommended):
- Web login calls backend `POST /api/v1/auth/login`
- Dashboard shows a live backend summary/risk panel (`/dashboard/summary`, `/dashboard/risk`)

Demo mode notes:
- These `VITE_*` values are embedded into the frontend build and are visible to users.
- This removes hardcoded credentials from source, but it is **not secure authentication**.

## Key Deliverables in This Folder
- `src/App.jsx`: Migrated finance app
- `src/styles.css`: Extracted styling from prototype
- `backend/`: Runnable Express + PostgreSQL backend starter (JWT auth, clients/loans/collections/dashboard/report APIs)
- `backend/schema.sql`: PostgreSQL schema design for production backend
- `docs/api-endpoints.md`: API endpoint contract (web + Android + sync)
- `docs/android-app-plan.md`: Android screen flow and offline sync strategy
