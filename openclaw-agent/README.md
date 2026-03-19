# OpenClaw Agent

Standalone lending growth and operations console.

## Frontend

```bash
npm run dev
```

## Backend

```bash
npm run dev:server
```

The frontend talks to the backend through `VITE_API_BASE_URL` and `VITE_WS_URL`.

## Messaging connectors

- WhatsApp Cloud API via `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
- Telegram Bot API via `TELEGRAM_BOT_TOKEN`
- Twilio SMS via `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- SMTP email via `SMTP_*`

## Persistence

- If `DATABASE_URL` is set, the backend persists state to PostgreSQL.
- Set `DATABASE_SSL=true` when connecting to SSL-only Postgres endpoints from local or external environments.
- Otherwise it falls back to a local JSON file at `STATE_FILE`.
- Run migrations with:

```bash
npm run migrate
```

## Render deploy

- Blueprint file: [render.yaml](/Users/jegannathan/Documents/New%20project/openclaw-agent/render.yaml)
- Backend service root: `openclaw-agent`
- Health check: `/api/health`
- Managed Postgres is declared in the same blueprint

After the backend is deployed, set:

```bash
VITE_API_BASE_URL=https://your-backend-host/api
VITE_WS_URL=wss://your-backend-host/ws
```

## Notes

- The Netlify site hosts the frontend only.
- The Express/WebSocket backend should be hosted separately on Render, Railway, Fly.io, or your own server.
