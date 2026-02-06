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

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizeRole = (role) => (String(role || "").toLowerCase() === "admin" ? "admin" : "staff");

const optionalName = (name) => {
  const n = String(name || "").trim();
  return n ? n.slice(0, 120) : "";
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return text(405, "Method Not Allowed");

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return json(500, { ok: false, error: "Server missing Supabase env vars." });
  if (!serviceRoleKey) return json(500, { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY (service role key)." });

  const auth = event.headers.authorization || event.headers.Authorization || "";
  if (!auth.startsWith("Bearer ")) return json(401, { ok: false, error: "Missing Authorization Bearer token." });
  const token = auth.slice("Bearer ".length);

  const body = safeJsonParse(event.body);
  if (!body) return json(400, { ok: false, error: "Invalid JSON body." });

  const action = String(body.action || "").trim();
  const email = normalizeEmail(body.email);
  const fullName = optionalName(body.fullName);
  const role = normalizeRole(body.role);

  if (!email || !email.includes("@")) return json(400, { ok: false, error: "Valid email is required." });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const userRes = await userClient.auth.getUser(token);
  const viewer = userRes?.data?.user;
  if (userRes?.error || !viewer?.id) return json(401, { ok: false, error: "Invalid or expired session." });

  const roleRes = await userClient.from("profiles").select("role").eq("user_id", viewer.id).maybeSingle();
  const viewerRole = roleRes?.data?.role || "staff";
  if (viewerRole !== "admin") return json(403, { ok: false, error: "Admin access required." });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const upsertProfile = async (userId) => {
    if (!userId) return;
    const patch = { user_id: userId, role };
    if (email) patch.email = email;
    if (fullName) patch.full_name = fullName;
    const res = await adminClient.from("profiles").upsert(patch, { onConflict: "user_id" });
    if (res.error) throw new Error(res.error.message || "Failed to update profile.");
  };

  if (action === "create_user") {
    const password = String(body.password || "");
    if (!password || password.length < 8) return json(400, { ok: false, error: "Password must be at least 8 characters." });

    const created = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (created.error) return json(400, { ok: false, error: created.error.message || "Create user failed." });

    const newUser = created?.data?.user;
    await upsertProfile(newUser?.id);

    return json(200, { ok: true, action, userId: newUser?.id || null, email, role });
  }

  if (action === "invite_user") {
    const redirectTo = String(body.redirectTo || "").trim();
    const invited = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: fullName ? { full_name: fullName } : undefined,
        redirectTo: redirectTo || undefined,
      }
    );
    if (invited.error) return json(400, { ok: false, error: invited.error.message || "Invite failed." });

    const newUser = invited?.data?.user;
    await upsertProfile(newUser?.id);

    return json(200, { ok: true, action, userId: newUser?.id || null, email, role });
  }

  return json(400, { ok: false, error: "Unknown action." });
}

