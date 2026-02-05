const AI_FN_PATH = "/.netlify/functions/ai";

const normalizeBase = (base) => String(base || "").trim().replace(/\/+$/, "");

const isHttpOrigin = () => {
  try {
    return typeof window !== "undefined" && /^https?:$/.test(window.location.protocol);
  } catch {
    return true;
  }
};

export const getAiFunctionUrl = () => {
  const base = normalizeBase(import.meta.env.VITE_AI_BASE_URL);
  if (base) return `${base}${AI_FN_PATH}`;
  return AI_FN_PATH;
};

export async function callAiAction({ supabase, action, payload = {}, tone = "partner", language = "English" }) {
  if (!supabase) throw new Error("AI requires Supabase login.");

  const url = getAiFunctionUrl();
  if (!url.startsWith("http") && !isHttpOrigin()) {
    throw new Error("AI endpoint not configured for mobile. Set VITE_AI_BASE_URL to your Netlify site URL and rebuild the app.");
  }

  const sessionRes = await supabase.auth.getSession();
  const token = sessionRes?.data?.session?.access_token;
  if (!token) throw new Error("Not logged in.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, tone, language, ...payload }),
  });

  const raw = await res.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = data?.error || raw || `AI request failed (${res.status})`;
    throw new Error(msg);
  }

  if (!data?.ok) throw new Error(data?.error || "AI request failed");
  if (!data?.text) throw new Error("AI returned empty response");
  return String(data.text);
}

