import cors from "cors";
import express from "express";
import http from "http";
import {
  autoClearInbox,
  createActivity,
  extractLeadFromMessage,
  formatCompactCurrency,
  importDsaCsv,
  launchCampaign,
  markLeadStage,
  respondToConversation,
  runAgentCommand,
  scheduleBroadcast,
  sendLeadFollowups,
  logPayment,
} from "../src/openclaw/engine.js";
import { config } from "./config.js";
import { createConnectorRegistry } from "./connectors.js";
import { createRealtimeServer } from "./realtime.js";
import { createStateStore } from "./store.js";

const app = express();
const server = http.createServer(app);

const store = await createStateStore({
  databaseUrl: config.databaseUrl,
  stateFile: config.stateFile,
});

const connectors = createConnectorRegistry(config);
const realtime = createRealtimeServer(server, store);

app.use(cors({ origin: config.frontendOrigin, credentials: false }));
app.use(express.json({ limit: "1mb" }));

const commit = async (nextState, meta = {}) => {
  const saved = await store.replaceState(nextState);
  realtime.broadcast({ type: "state.updated", state: saved, meta });
  return saved;
};

const sendResult = (res, { state, response = "", summary = "", meta = {} }) => {
  res.json({ ok: true, state, response, summary, meta });
};

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    runtime: "express",
    storageMode: store.mode,
    websocketPath: "/ws",
    connectors: connectors.getStatuses(),
  });
});

app.get("/api/state", (req, res) => {
  res.json({ ok: true, state: store.getState() });
});

app.post("/api/state/reset", async (req, res) => {
  const state = await store.reset();
  realtime.broadcast({ type: "state.snapshot", state });
  res.json({ ok: true, state, response: "Backend state reset to seeded baseline." });
});

app.post("/api/commands", async (req, res) => {
  const { command = "" } = req.body || {};
  const result = runAgentCommand(store.getState(), command);
  const state = await commit(result.state, { action: "command" });
  sendResult(res, { state, response: result.response });
});

app.post("/api/import/dsa", async (req, res) => {
  const { csvText = "" } = req.body || {};
  const result = importDsaCsv(store.getState(), csvText);
  const state = await commit(result.state, { action: "import-dsa" });
  sendResult(res, { state, response: result.summary, summary: result.summary });
});

app.post("/api/campaigns", async (req, res) => {
  const state = await commit(launchCampaign(store.getState(), req.body || {}), { action: "launch-campaign" });
  sendResult(res, { state, response: `Campaign '${req.body?.name || "Untitled"}' launched.` });
});

app.post("/api/conversations/:conversationId/respond", async (req, res) => {
  const { conversationId } = req.params;
  const { text = "" } = req.body || {};
  const nextState = respondToConversation(store.getState(), conversationId, text);
  const state = await commit(nextState, { action: "respond-conversation", conversationId });
  sendResult(res, { state, response: "Conversation updated." });
});

app.post("/api/inbox/auto-clear", async (req, res) => {
  const state = await commit(autoClearInbox(store.getState()), { action: "auto-clear-inbox" });
  sendResult(res, { state, response: "Routine inbox queue cleared." });
});

app.post("/api/leads/extract-sample", async (req, res) => {
  const state = store.getState();
  const dsa = state.dsaContacts.find((item) => item.id === "dsa-001");
  const lead = extractLeadFromMessage("I have a client Ramesh needs PL 5 lakh salaried TCS Chennai", dsa);
  const nextState = {
    ...state,
    leads: [lead, ...state.leads],
    activityFeed: [
      createActivity("Lead Pipeline", `Sample lead extraction created ${lead.name} for ${formatCompactCurrency(lead.amount)} from ${dsa?.name || "DSA"}.`),
      ...state.activityFeed,
    ],
  };
  const saved = await commit(nextState, { action: "extract-sample-lead" });
  sendResult(res, { state: saved, response: `Lead extractor parsed ${lead.name}.` });
});

app.post("/api/leads/followups", async (req, res) => {
  const state = await commit(sendLeadFollowups(store.getState()), { action: "lead-followups" });
  sendResult(res, { state, response: "Lead follow-ups sent." });
});

app.patch("/api/leads/:leadId/stage", async (req, res) => {
  const { leadId } = req.params;
  const { stage } = req.body || {};
  const state = await commit(markLeadStage(store.getState(), leadId, stage), { action: "lead-stage", leadId, stage });
  sendResult(res, { state, response: `Lead moved to ${stage}.` });
});

app.post("/api/borrowers/:borrowerId/payments", async (req, res) => {
  const { borrowerId } = req.params;
  const { amount = 0 } = req.body || {};
  const state = await commit(logPayment(store.getState(), borrowerId, amount), { action: "borrower-payment", borrowerId });
  sendResult(res, { state, response: `Payment of ${amount} logged.` });
});

app.post("/api/reports/briefing/share", async (req, res) => {
  const state = await commit(scheduleBroadcast(store.getState(), "Morning Briefing", "owner WhatsApp", "Today 07:00 AM"), {
    action: "briefing-share",
  });
  sendResult(res, { state, response: "Morning briefing queued." });
});

app.get("/api/connectors/status", (req, res) => {
  res.json({ ok: true, connectors: connectors.getStatuses(), storageMode: store.mode });
});

app.post("/api/messages/send", async (req, res) => {
  const { channel, to, text, subject = "OpenClaw Notification" } = req.body || {};
  try {
    let result;
    if (channel === "whatsapp") {
      result = await connectors.sendWhatsappText({ to, text });
    } else if (channel === "telegram") {
      result = await connectors.sendTelegramText({ chatId: to, text });
    } else if (channel === "sms") {
      result = await connectors.sendSms({ to, text });
    } else if (channel === "email") {
      result = await connectors.sendEmail({ to, subject, text });
    } else {
      res.status(400).json({ ok: false, error: "Unsupported channel." });
      return;
    }

    const nextState = {
      ...store.getState(),
      activityFeed: [createActivity("DSA Outreach", `Outbound ${channel} message sent to ${to}.`), ...store.getState().activityFeed],
    };
    const state = await commit(nextState, { action: "send-message", channel });
    res.json({ ok: true, result, state });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

app.get("/api/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && token === config.whatsapp.verifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).send("verification_failed");
});

app.post("/api/webhooks/whatsapp", async (req, res) => {
  const payload = req.body || {};
  const nextState = {
    ...store.getState(),
    activityFeed: [createActivity("DSA Outreach", "WhatsApp webhook event received."), ...store.getState().activityFeed],
  };
  await commit(nextState, { action: "whatsapp-webhook" });
  res.json({ ok: true, received: true, payload });
});

app.post("/api/webhooks/telegram", async (req, res) => {
  const nextState = {
    ...store.getState(),
    activityFeed: [createActivity("DSA Outreach", "Telegram webhook event received."), ...store.getState().activityFeed],
  };
  await commit(nextState, { action: "telegram-webhook" });
  res.json({ ok: true, received: true });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: String(error.message || error) });
});

server.listen(config.port, config.host, () => {
  console.log(`OpenClaw backend listening on ${config.appBaseUrl}`);
  console.log(`Storage mode: ${store.mode}`);
});

const shutdown = async () => {
  realtime.close();
  await store.close();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
