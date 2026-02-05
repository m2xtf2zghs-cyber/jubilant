import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

const text = (statusCode, body) => ({
  statusCode,
  headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  body: String(body ?? ""),
});

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
};

const normalizeTone = (tone) => {
  const t = String(tone || "").toLowerCase();
  if (t === "corporate" || t === "strict") return "corporate";
  if (t === "partner" || t === "friendly") return "partner";
  return "partner";
};

const normalizeLanguage = (language) => {
  const l = String(language || "").trim();
  return l ? l.slice(0, 40) : "English";
};

const toneInstruction = (tone) => {
  if (tone === "corporate") {
    return [
      "Tone: formal, firm, audit-safe, and concise.",
      "Avoid slang, emojis, and markdown.",
      "Do not invent facts. If a detail is unknown, keep it generic.",
    ].join("\n");
  }
  return [
    "Tone: professional, polite, partner-friendly, and concise.",
    "Avoid emojis and markdown.",
    "Do not invent facts. If a detail is unknown, keep it generic.",
  ].join("\n");
};

const takeLastNotes = (notes, max = 6) => {
  const list = Array.isArray(notes) ? notes : [];
  const trimmed = list
    .filter(Boolean)
    .map((n) => {
      if (typeof n === "string") return { text: n, date: null };
      if (typeof n === "object") return { text: String(n.text || ""), date: n.date ? String(n.date) : null };
      return null;
    })
    .filter((n) => n && n.text);
  return trimmed.slice(Math.max(0, trimmed.length - max));
};

const summarizeLeadForPrompt = (lead) => {
  const docs = lead?.documents && typeof lead.documents === "object" ? lead.documents : {};
  const notes = takeLastNotes(lead?.notes, 6);
  return {
    id: lead?.id,
    name: lead?.name || "",
    company: lead?.company || "",
    location: lead?.location || "",
    phone: lead?.phone || "",
    status: lead?.status || "",
    loanAmount: lead?.loan_amount ?? lead?.loanAmount ?? 0,
    nextFollowUp: lead?.next_follow_up || lead?.nextFollowUp || null,
    assignedStaff: lead?.assigned_staff || lead?.assignedStaff || null,
    documents: {
      kyc: !!docs.kyc,
      itr: !!docs.itr,
      bank: !!docs.bank,
    },
    lastNotes: notes,
  };
};

const geminiGenerateText = async ({ apiKey, model, prompt, temperature = 0.2, maxOutputTokens = 350 }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: `Gemini error (${res.status}): ${raw.slice(0, 500)}` };
  }

  const data = safeJsonParse(raw);
  const candidate = data?.candidates?.[0];
  const textOut = candidate?.content?.parts?.map((p) => p?.text).filter(Boolean).join("") || "";
  return { ok: true, text: textOut.trim() };
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return text(405, "Method Not Allowed");

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return json(500, { ok: false, error: "Server missing Supabase env vars." });

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  if (!geminiApiKey) return json(500, { ok: false, error: "AI not configured. Missing GEMINI_API_KEY on server." });

  const auth = event.headers.authorization || event.headers.Authorization || "";
  if (!auth.startsWith("Bearer ")) return json(401, { ok: false, error: "Missing Authorization Bearer token." });
  const token = auth.slice("Bearer ".length);

  const body = safeJsonParse(event.body);
  if (!body) return json(400, { ok: false, error: "Invalid JSON body." });

  const action = String(body.action || "").trim();
  const tone = normalizeTone(body.tone);
  const language = normalizeLanguage(body.language);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const userRes = await supabase.auth.getUser(token);
  const user = userRes?.data?.user;
  if (userRes?.error || !user?.id) return json(401, { ok: false, error: "Invalid or expired session." });

  const roleRes = await supabase.from("profiles").select("role,email,full_name").eq("user_id", user.id).maybeSingle();
  const role = roleRes?.data?.role || "staff";

  const leadId = body.leadId ? String(body.leadId) : null;

  const fetchLead = async () => {
    if (!leadId) return { ok: false, error: "leadId is required for this action." };
    const res = await supabase
      .from("leads")
      .select("id,name,company,location,phone,status,loan_amount,next_follow_up,assigned_staff,documents,notes,mediator_id,loan_details,rejection_details")
      .eq("id", leadId)
      .maybeSingle();
    if (res.error) return { ok: false, error: res.error.message || "Failed to load lead." };
    if (!res.data) return { ok: false, error: "Lead not found (or you don’t have access)." };
    return { ok: true, lead: res.data };
  };

  const fetchMediatorForLead = async (mediatorId) => {
    if (!mediatorId) return { ok: true, mediator: null };
    const res = await supabase.from("mediators").select("id,name,phone,follow_up_history").eq("id", mediatorId).maybeSingle();
    if (res.error) return { ok: false, error: res.error.message || "Failed to load mediator." };
    return { ok: true, mediator: res.data || null };
  };

  let prompt = "";

  if (action === "rejection_draft") {
    const leadRes = await fetchLead();
    if (!leadRes.ok) return json(404, { ok: false, error: leadRes.error });
    const lead = leadRes.lead;

    const strategy = String(body.strategy || "").trim();
    const reason = String(body.reason || "").trim();
    const competitor = String(body.competitor || "").trim();
    const extra = String(body.extraNotes || "").trim();

    if (!strategy || !reason) return json(400, { ok: false, error: "strategy and reason are required." });

    prompt = [
      "You are writing a rejection justification for a corporate finance team (loan application).",
      "Output requirement: EXACTLY 2–3 lines (short sentences). No bullet points. No markdown.",
      toneInstruction(tone),
      `Language: ${language}`,
      "",
      "Context:",
      JSON.stringify(
        {
          lead: summarizeLeadForPrompt(lead),
          rejection: { strategy, reason, competitor: competitor || null, userContext: extra || null },
          viewerRole: role,
        },
        null,
        2
      ),
      "",
      "Write the 2–3 lines now.",
    ].join("\n");
  } else if (action === "lead_summary") {
    const leadRes = await fetchLead();
    if (!leadRes.ok) return json(404, { ok: false, error: leadRes.error });
    const lead = leadRes.lead;

    prompt = [
      "You are an assistant helping a corporate finance operations team manage a lead pipeline.",
      "Output requirement: plain text, no markdown.",
      toneInstruction(tone),
      `Language: ${language}`,
      "",
      "Given a lead object, produce:",
      "1) Summary (3 short lines)",
      "2) Next action (1 line)",
      "3) Suggested follow-up message to the client (1 line, WhatsApp-friendly)",
      "",
      "Lead:",
      JSON.stringify(summarizeLeadForPrompt(lead), null, 2),
    ].join("\n");
  } else if (action === "whatsapp_draft") {
    const leadRes = await fetchLead();
    if (!leadRes.ok) return json(404, { ok: false, error: leadRes.error });
    const lead = leadRes.lead;

    const recipient = String(body.recipient || "client").toLowerCase();
    const mediatorRes = recipient === "mediator" ? await fetchMediatorForLead(lead.mediator_id) : { ok: true, mediator: null };
    if (!mediatorRes.ok) return json(500, { ok: false, error: mediatorRes.error });

    const goal = String(body.goal || "").trim();
    prompt = [
      "Write a short WhatsApp message for a finance team to send.",
      "Output requirement: message text only. No quotes. No markdown. Max 3 lines.",
      toneInstruction(tone),
      `Language: ${language}`,
      "",
      `Recipient: ${recipient === "mediator" ? "Partner/Mediator" : "Client"}`,
      goal ? `Goal: ${goal}` : "",
      "",
      "Lead:",
      JSON.stringify(summarizeLeadForPrompt(lead), null, 2),
      mediatorRes.mediator ? `\nMediator:\n${JSON.stringify({ name: mediatorRes.mediator.name, phone: mediatorRes.mediator.phone }, null, 2)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (action === "meeting_brief") {
    const leadRes = await fetchLead();
    if (!leadRes.ok) return json(404, { ok: false, error: leadRes.error });
    const lead = leadRes.lead;

    prompt = [
      "You are preparing a quick call/meeting briefing for a corporate finance field/ops staff member.",
      "Output requirement: plain text, no markdown. Use short dash bullets only.",
      toneInstruction(tone),
      `Language: ${language}`,
      "",
      "Create a checklist of 6–10 bullets for what to confirm/ask next, based on this lead:",
      JSON.stringify(summarizeLeadForPrompt(lead), null, 2),
    ].join("\n");
  } else if (action === "missing_docs") {
    const leadRes = await fetchLead();
    if (!leadRes.ok) return json(404, { ok: false, error: leadRes.error });
    const lead = leadRes.lead;

    prompt = [
      "You are assisting a corporate finance ops team.",
      "Output requirement: plain text, no markdown. Use short dash bullets only.",
      toneInstruction(tone),
      `Language: ${language}`,
      "",
      "From this lead data, identify missing documents and the next best actions.",
      "Return 6–10 bullets. Be practical and non-legal. Do not invent unknown documents.",
      JSON.stringify(summarizeLeadForPrompt(lead), null, 2),
    ].join("\n");
  } else if (action === "mediator_insights") {
    const rangeDays = Number(body.rangeDays || 30);
    const now = Date.now();
    const cutoff = isFinite(rangeDays) && rangeDays > 0 ? now - rangeDays * 86400000 : null;

    const [leadsRes, mediatorsRes] = await Promise.all([
      supabase.from("leads").select("id,created_at,status,loan_amount,mediator_id").order("created_at", { ascending: false }),
      supabase.from("mediators").select("id,name,phone,follow_up_history").order("name", { ascending: true }),
    ]);

    if (leadsRes.error) return json(500, { ok: false, error: leadsRes.error.message || "Failed to load leads." });
    if (mediatorsRes.error) return json(500, { ok: false, error: mediatorsRes.error.message || "Failed to load mediators." });

    const leads = Array.isArray(leadsRes.data) ? leadsRes.data : [];
    const mediators = Array.isArray(mediatorsRes.data) ? mediatorsRes.data : [];

    const byMediator = new Map();
    for (const m of mediators) byMediator.set(m.id, { id: m.id, name: m.name, phone: m.phone || "", total: 0, closed: 0, active: 0, volumeClosed: 0, lastLeadAt: null });

    for (const l of leads) {
      if (!l.mediator_id) continue;
      const entry = byMediator.get(l.mediator_id);
      if (!entry) continue;
      entry.total += 1;
      const isClosed = l.status === "Payment Done" || l.status === "Deal Closed";
      if (isClosed) {
        entry.closed += 1;
        entry.volumeClosed += Number(l.loan_amount || 0);
      } else {
        entry.active += 1;
      }
      if (!entry.lastLeadAt) entry.lastLeadAt = l.created_at || null;
    }

    const stats = [...byMediator.values()].map((m) => {
      const daysSinceLastLead =
        m.lastLeadAt && !Number.isNaN(new Date(m.lastLeadAt).getTime())
          ? Math.floor((now - new Date(m.lastLeadAt).getTime()) / 86400000)
          : null;
      return { ...m, daysSinceLastLead };
    });

    const payload = {
      rangeDays: cutoff ? rangeDays : null,
      mediators: stats,
      totals: {
        mediators: stats.length,
        leads: leads.length,
      },
    };

    prompt = [
      "You are a business analyst for a corporate finance team.",
      "Output requirement: plain text, no markdown.",
      toneInstruction(tone),
      `Language: ${language}`,
      "",
      "Tasks:",
      '1) Identify "Dormant Mediators" (no lead in >30 days).',
      "2) Identify Top Performers (high closed volume + conversion).",
      "3) Provide a concise re-engagement strategy (actionable).",
      "",
      "Data (JSON):",
      JSON.stringify(payload, null, 2),
    ].join("\n");
  } else if (action === "report_summary") {
    const metrics = body.metrics && typeof body.metrics === "object" ? body.metrics : null;
    if (!metrics) return json(400, { ok: false, error: "metrics is required." });

    prompt = [
      "You are drafting an executive summary for a corporate finance internal performance report.",
      "Output requirement: plain text, no markdown.",
      toneInstruction(tone),
      `Language: ${language}`,
      "",
      "Return:",
      "1) One short paragraph summary (3–4 lines).",
      "2) Key highlights (3 short lines).",
      "",
      "Metrics (JSON):",
      JSON.stringify(metrics, null, 2),
    ].join("\n");
  } else if (action === "translate") {
    const input = String(body.text || "").trim();
    const target = normalizeLanguage(body.targetLanguage);
    if (!input) return json(400, { ok: false, error: "text is required." });

    prompt = [
      "Translate the text exactly and naturally.",
      "Output requirement: translation only. No quotes. No markdown.",
      `Target language: ${target}`,
      "",
      input,
    ].join("\n");
  } else {
    return json(400, { ok: false, error: "Unknown action." });
  }

  const modelCandidates = process.env.GEMINI_MODEL
    ? [geminiModel]
    : [
        geminiModel, // default
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash",
      ];

  let gen = null;
  for (const candidate of modelCandidates) {
    // eslint-disable-next-line no-await-in-loop
    const attempt = await geminiGenerateText({ apiKey: geminiApiKey, model: candidate, prompt });
    if (attempt.ok) {
      gen = attempt;
      break;
    }
    gen = attempt;
    // Only try fallbacks when the default model is missing.
    if (attempt.status !== 404) break;
  }

  if (!gen?.ok) return json(502, { ok: false, error: gen?.error || "AI request failed." });
  if (!gen.text) return json(502, { ok: false, error: "AI returned empty response." });

  return json(200, { ok: true, text: gen.text });
}
