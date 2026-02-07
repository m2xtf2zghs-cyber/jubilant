import { getFunctionsBaseUrl } from "./functionsBase.js";

const ADMIN_FN_PATH = "/.netlify/functions/admin-users";

const isHttpOrigin = () => {
  try {
    return typeof window !== "undefined" && /^https?:$/.test(window.location.protocol);
  } catch {
    return true;
  }
};

export const getAdminFunctionUrl = () => {
  const base = getFunctionsBaseUrl();
  if (base) return `${base}${ADMIN_FN_PATH}`;
  return ADMIN_FN_PATH;
};

export async function callAdminAction({ supabase, action, payload = {} }) {
  if (!supabase) throw new Error("Admin tools require Supabase login.");

  const url = getAdminFunctionUrl();
  if (!url.startsWith("http") && !isHttpOrigin()) {
    throw new Error(
      "Admin endpoint not configured for mobile. Set VITE_FUNCTIONS_BASE_URL (or VITE_AI_BASE_URL) to your Netlify site URL, or set it in Settings → About this build."
    );
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
    body: JSON.stringify({ action, ...payload }),
  });

  const raw = await res.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = data?.error || raw || `Admin request failed (${res.status})`;
    throw new Error(msg);
  }

  if (!data?.ok) throw new Error(data?.error || "Admin request failed");
  return data;
}
