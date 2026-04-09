import { createClient } from "@supabase/supabase-js";
import { buildOpenclawFollowupQueues } from "../../src/openclaw/followupQueue.js";

const TELEGRAM_API = "https://api.telegram.org";

const response = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

const safeJsonParse = (raw, fallback = null) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const parseBindings = () => {
  const raw = String(process.env.TELEGRAM_CHAT_BINDINGS || "").trim();
  if (!raw) return {};
  const parsed = safeJsonParse(raw, {});
  return parsed && typeof parsed === "object" ? parsed : {};
};

const resolveUserIdForChat = (chatId) => {
  const bindings = parseBindings();
  const fromMap = bindings[String(chatId)] || bindings[Number(chatId)] || "";
  if (fromMap) return String(fromMap).trim();

  const allowedChats = String(process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const defaultUserId = String(process.env.TELEGRAM_DEFAULT_USER_ID || "").trim();

  if (defaultUserId && allowedChats.includes(String(chatId))) return defaultUserId;
  return "";
};

const sendTelegramMessage = async (botToken, chatId, text, extra = {}) => {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...extra,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    throw new Error(`Telegram send failed (${res.status}): ${raw}`);
  }
  return res.json();
};

const toUiLead = (row) => ({
  id: row.id,
  name: row.name || row.company || "Unnamed Lead",
  company: row.company || "",
  phone: row.phone || "",
  status: row.status || "New",
  loanAmount: Number(row.loan_amount || 0),
  nextFollowUp: row.next_follow_up || null,
  notes: Array.isArray(row.notes) ? row.notes : [],
  mediatorId: row.mediator_id || "3",
  ownerId: row.owner_id || "",
  createdAt: row.created_at || null,
});

const toUiMediator = (row) => ({
  id: row.id,
  name: row.name || "Mediator",
  phone: row.phone || "",
  ownerId: row.owner_id || "",
});

const ymdIst = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
};

const todayIst = () => ymdIst(new Date());

const formatAmount = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

const formatTodayQueue = (queue) => {
  if (!queue.length) return "No client follow-ups due today.";
  return [
    "Today follow-ups:",
    ...queue.slice(0, 10).map(
      (row, index) =>
        `${index + 1}. ${row.name} | ${row.status} | ${row.mediatorName} | ${row.nextFollowUpLabel}`
    ),
  ].join("\n");
};

const formatPartnerQueue = (groups) => {
  if (!groups.length) return "No mediator-side pending queue right now.";
  return [
    "Mediator follow-up queue:",
    ...groups.slice(0, 10).map(
      (group, index) => `${index + 1}. ${group.mediator?.name || "Mediator"} - ${group.rows.length} case(s)`
    ),
  ].join("\n");
};

const formatClientQueue = (queue) => {
  if (!queue.length) return "No client-side follow-up queue right now.";
  return [
    "Client follow-up queue:",
    ...queue.slice(0, 10).map(
      (row, index) => `${index + 1}. ${row.name} | ${row.status} | ${row.nextFollowUpLabel} | ${formatAmount(row.loanAmount)}`
    ),
  ].join("\n");
};

const formatSummary = ({ mediatorQueueBase, clientQueue }) => {
  const dueToday = clientQueue.filter((row) => ymdIst(row.nextFollowUp) === todayIst()).length;
  const overdue = clientQueue.filter((row) => {
    const ymd = ymdIst(row.nextFollowUp);
    return ymd && ymd < todayIst();
  }).length;
  return [
    "OpenClaw queue summary:",
    `Mediator queue: ${mediatorQueueBase.length}`,
    `Client queue: ${clientQueue.length}`,
    `Due today: ${dueToday}`,
    `Overdue: ${overdue}`,
    mediatorQueueBase[0]?.mediator?.name ? `Priority mediator: ${mediatorQueueBase[0].mediator.name}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const helpText = [
  "Jubilant OpenClaw bot",
  "/today - client follow-ups due today",
  "/partners - mediator follow-up queue",
  "/clients - client follow-up queue",
  "/summary - queue summary",
].join("\n");

const fetchQueuesForUser = async (adminClient, userId) => {
  const { data: leadRows, error: leadError } = await adminClient
    .from("leads")
    .select("id,name,company,phone,status,loan_amount,next_follow_up,notes,mediator_id,owner_id,created_at")
    .eq("owner_id", userId);
  if (leadError) throw leadError;

  const { data: mediatorRows, error: mediatorError } = await adminClient
    .from("mediators")
    .select("id,name,phone,owner_id")
    .eq("owner_id", userId);
  if (mediatorError) throw mediatorError;

  return buildOpenclawFollowupQueues({
    leads: (leadRows || []).map(toUiLead),
    mediators: (mediatorRows || []).map(toUiMediator),
  });
};

export async function handler(event) {
  if (event.httpMethod !== "POST") return response(405, { ok: false, error: "Method not allowed" });

  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const secretToken = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!botToken || !supabaseUrl || !serviceRoleKey) {
    return response(500, { ok: false, error: "Missing Telegram or Supabase server configuration." });
  }

  if (secretToken) {
    const inboundSecret =
      event.headers["x-telegram-bot-api-secret-token"] ||
      event.headers["X-Telegram-Bot-Api-Secret-Token"] ||
      "";
    if (String(inboundSecret) !== secretToken) {
      return response(401, { ok: false, error: "Invalid Telegram webhook secret." });
    }
  }

  const update = safeJsonParse(event.body, {});
  const message = update?.message || update?.edited_message || null;
  const chatId = message?.chat?.id;
  const text = String(message?.text || "").trim();

  if (!chatId || !text.startsWith("/")) {
    return response(200, { ok: true, ignored: true });
  }

  const userId = resolveUserIdForChat(chatId);
  if (!userId) {
    await sendTelegramMessage(botToken, chatId, "This chat is not linked to a Jubilant user yet.");
    return response(200, { ok: true, linked: false });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const queues = await fetchQueuesForUser(adminClient, userId);
    const command = text.split(/\s+/)[0].toLowerCase();

    let reply = helpText;
    if (command === "/start" || command === "/help") {
      reply = helpText;
    } else if (command === "/today") {
      const todayQueue = queues.clientQueue.filter((row) => ymdIst(row.nextFollowUp) === todayIst());
      reply = formatTodayQueue(todayQueue);
    } else if (command === "/partners") {
      reply = formatPartnerQueue(queues.mediatorQueueBase);
    } else if (command === "/clients") {
      reply = formatClientQueue(queues.clientQueue);
    } else if (command === "/summary") {
      reply = formatSummary(queues);
    }

    await sendTelegramMessage(botToken, chatId, reply);
    return response(200, { ok: true });
  } catch (error) {
    await sendTelegramMessage(botToken, chatId, `OpenClaw bot error: ${error?.message || "Unknown error"}`);
    return response(500, { ok: false, error: error?.message || "Unknown error" });
  }
}
