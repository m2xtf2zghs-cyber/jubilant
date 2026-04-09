# OpenClaw Setup for LIRAS

OpenClaw is a self-hosted personal AI assistant that runs locally on your Mac. LIRAS uses it for two things:

1. **AI chat via the local Gateway** — route AI actions (lead summaries, WhatsApp drafts, etc.) through your own agent instead of the Netlify/Gemini stack.
2. **WhatsApp message sending** — actually deliver AI-drafted messages to leads/mediators through your linked WhatsApp account.

---

## 1. Install OpenClaw on your Mac

> Requires Node 22.16+. Check with `node --version`.

```bash
npm install -g openclaw@latest
```

If you get `command not found: openclaw` after install, your npm bin isn't in PATH. Fix it:

```bash
# Add to ~/.zshrc (or ~/.bashrc)
export PATH="$(npm config get prefix)/bin:$PATH"
source ~/.zshrc
```

If npm isn't installed at all, use Homebrew first:
```bash
brew install node
npm install -g openclaw@latest
```

Verify:
```bash
openclaw --version
# OpenClaw 2026.4.2 (or newer)
```

---

## 2. Run onboarding (optional interactive setup)

The guided setup covers gateway config, channel linking, and daemon install in one shot:

```bash
openclaw onboard --install-daemon
```

During onboarding you can:
- Set up WhatsApp (scan QR code in terminal)
- Install the Gateway as a macOS launch daemon so it auto-starts

You can also skip onboarding and run the individual config commands in steps 3–6 below.

---

## 3. Set gateway auth token

LIRAS needs a shared secret to talk to the Gateway. Run these three commands exactly:

```bash
openclaw config set gateway.auth.mode token
openclaw config set gateway.auth.token IthB7U-i5Dgmi8nCAalqV8I63tKWY67VjQwBgRI868c
openclaw config set gateway.http.endpoints.chatCompletions.enabled true
```

> The token `IthB7U-i5Dgmi8nCAalqV8I63tKWY67VjQwBgRI868c` is already set in LIRAS's `.env`. You can change it — just update both places.

---

## 4. Configure DeepSeek V3 via OpenRouter

Set DeepSeek as the default model:

```bash
openclaw models set "openrouter/deepseek/deepseek-chat-v3-0324"
```

Add your OpenRouter API key:

```bash
openclaw models auth paste-token --provider openrouter
# Paste token: <your sk-or-... key>
```

Start (or restart) the gateway:

```bash
openclaw gateway run --allow-unconfigured
# Or if installed as daemon:
openclaw gateway restart
```

Verify everything is working:
```bash
curl -sS http://127.0.0.1:18789/health
# → {"ok":true,"status":"live"}

curl -sS http://127.0.0.1:18789/v1/models \
  -H 'Authorization: Bearer IthB7U-i5Dgmi8nCAalqV8I63tKWY67VjQwBgRI868c'
# → lists openclaw/default, openclaw/main, etc.
```

---

## 5. (Optional) Link WhatsApp

If you want LIRAS to send WhatsApp messages through OpenClaw:

```bash
openclaw channels login --channel whatsapp
```

Follow the QR scan prompt in your terminal, then confirm on your phone.

---

## 6. LIRAS .env (already configured)

Your `.env` already has the right values:

```env
VITE_OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
VITE_OPENCLAW_GATEWAY_TOKEN=IthB7U-i5Dgmi8nCAalqV8I63tKWY67VjQwBgRI868c
```

Restart the dev server after any .env changes: `npm run dev`

---

## 7. Mobile / Capacitor builds

The Gateway runs on your Mac, not on the phone. For Capacitor builds to reach it:

**Option A — LAN (same Wi-Fi network)**

Find your Mac's local IP:
```bash
ipconfig getifaddr en0
```

Then in `.env`:
```env
VITE_OPENCLAW_GATEWAY_URL=http://192.168.1.X:18789
```

Restart the gateway with LAN binding:
```bash
openclaw gateway run --bind lan
```

**Option B — Tailscale (recommended, works anywhere)**

Install [Tailscale](https://tailscale.com) on your Mac and phone, then:
```bash
openclaw gateway run --bind tailnet
```

Use your Tailscale hostname:
```env
VITE_OPENCLAW_GATEWAY_URL=http://your-machine.tailnet.ts.net:18789
```

---

## 8. Verify the connection

Run the LIRAS dev server and check the browser console — the `pingGateway()` utility in `src/openclaw/openclawGatewayClient.js` hits `/health`. You can also smoke-test from the terminal:

```bash
# Health check
curl -sS http://127.0.0.1:18789/health

# List available agents (requires token)
curl -sS http://127.0.0.1:18789/v1/models \
  -H 'Authorization: Bearer YOUR_CHOSEN_SECRET'

# Test a chat completion
curl -sS http://127.0.0.1:18789/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_CHOSEN_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"model":"openclaw/default","messages":[{"role":"user","content":"hi"}]}'
```

---

## Integration files in LIRAS

| File | Purpose |
|---|---|
| `src/openclaw/openclawConfig.js` | Reads `VITE_OPENCLAW_GATEWAY_URL` + `VITE_OPENCLAW_GATEWAY_TOKEN` from env |
| `src/openclaw/openclawGatewayClient.js` | Base HTTP client (`gatewayFetch`, `pingGateway`, `invokeTool`) |
| `src/openclaw/openclawChatClient.js` | AI chat via `/v1/chat/completions` — mirrors existing `aiClient.js` actions |
| `src/openclaw/openclawFollowupClient.js` | Jubilant-specific follow-up drafts for mediator queues, client queues, and owner summary |
| `src/openclaw/followupQueue.js` | Shared queue classification for the web studio and Telegram bot |
| `src/openclaw/openclawMessageClient.js` | Send WhatsApp/Telegram messages via Gateway tools |
| `src/openclaw/index.js` | Barrel export — `import { ... } from "./openclaw"` |
| `netlify/functions/telegram-webhook.mjs` | Telegram webhook using the same follow-up queue engine |

### OpenClaw Follow-Up Studio

Once configured, open:

- `Reports`
- `OpenClaw Follow-Up Studio`

The studio uses live lead data to:

- group partner-side follow-up cases by mediator
- build client follow-up queue drafts
- generate an owner queue summary
- optionally send the generated WhatsApp draft through the OpenClaw Gateway

### Telegram webhook

Add these Netlify environment variables:

```env
TELEGRAM_BOT_TOKEN=<telegram bot token>
TELEGRAM_WEBHOOK_SECRET=<random secret>
TELEGRAM_CHAT_BINDINGS={"845081136":"<jubilant-user-uuid>"}
SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>
```

Optional fallback for a single owner:

```env
TELEGRAM_ALLOWED_CHAT_IDS=845081136
TELEGRAM_DEFAULT_USER_ID=<jubilant-user-uuid>
```

Set Telegram to call the Netlify webhook after deploy:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://jubilantcrm.netlify.app/.netlify/functions/telegram-webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Supported bot commands:

- `/start`
- `/today`
- `/partners`
- `/clients`
- `/summary`

### Example usage in a component

```jsx
import { isOpenclawConfigured, openclawLeadSummary, sendWhatsappMessage } from "../openclaw";

// Check if OpenClaw is configured
if (!isOpenclawConfigured) {
  console.warn("OpenClaw not configured — set VITE_OPENCLAW_GATEWAY_URL and VITE_OPENCLAW_GATEWAY_TOKEN");
}

// Get a lead summary from your local agent
const summary = await openclawLeadSummary(lead, { tone: "partner", language: "English" });

// Draft + send a WhatsApp message
const draft = await openclawWhatsappDraft(lead, { goal: "Follow up on documents" });
await sendWhatsappMessage(lead.phone, draft);
```

---

## Useful OpenClaw commands

```bash
openclaw gateway status          # service status + health probe
openclaw gateway restart         # restart after config changes
openclaw status                  # channel health overview
openclaw channels login          # add/re-link a channel
openclaw logs                    # tail gateway logs
openclaw doctor                  # diagnose common issues
openclaw models                  # list configured model providers
```

---

## Docs

- Full docs: https://docs.openclaw.ai
- Gateway API: https://docs.openclaw.ai/gateway
- Channels: https://docs.openclaw.ai/channels
