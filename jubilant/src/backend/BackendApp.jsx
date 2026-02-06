import React, { useEffect, useMemo, useState } from "react";
import LirasApp from "../LirasApp.jsx";
import { supabase } from "./supabaseClient.js";
import { BRAND, BrandMark } from "../brand/Brand.jsx";

const LoadingScreen = ({ label = "Loading…" }) => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="w-full max-w-md surface p-6">
      <div className="flex items-center gap-3">
        <BrandMark size={34} />
        <div>
          <div className="text-lg font-extrabold text-slate-900">{label}</div>
          <div className="text-sm text-slate-500 mt-1">{BRAND.name} • {BRAND.product}</div>
        </div>
      </div>
    </div>
  </div>
);

const normalizeAuthError = (err) => {
  const msg = String(err?.message || err || "").trim() || "Something went wrong";
  if (/invalid api key/i.test(msg)) {
    return "Supabase is not configured correctly for this site (invalid anon key). Check Netlify env vars VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.";
  }
  if (/invalid login credentials/i.test(msg)) {
    return "Invalid email or password. If you were invited, ask your admin to set/reset your password.";
  }
  if (/failed to fetch/i.test(msg) || /network/i.test(msg)) {
    return "Network error connecting to Supabase. Check your internet connection and that the Supabase URL is correct.";
  }
  return msg;
};

const LoginScreen = ({ onLogin, onResetPassword }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // "login" | "reset"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setBusy(true);
    try {
      if (mode === "reset") {
        await onResetPassword(email.trim());
        setOk("Password reset email sent. Check your inbox (and spam) for the link.");
        return;
      }

      await onLogin(email.trim(), password);
    } catch (err) {
      setError(normalizeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md surface p-7 shadow-elevated">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark size={34} />
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{BRAND.name}</div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">
              {mode === "reset" ? "Reset password for " : "Sign in to "}
              <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">LIRAS v4.06</span>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {mode === "reset" ? "We’ll email a secure reset link." : "Invite-only access for staff accounts"}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full py-3"
              placeholder="name@company.com"
              autoComplete="email"
            />
          </div>
          {mode === "login" && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Password</label>
                <button
                  type="button"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  onClick={() => {
                    setMode("reset");
                    setError("");
                    setOk("");
                  }}
                >
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-3"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-bold">{error}</div>
          )}
          {ok && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-bold">{ok}</div>}

          <button
            type="submit"
            disabled={busy}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-soft transition ${
              busy ? "bg-slate-400" : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            }`}
          >
            {busy ? (mode === "reset" ? "Sending…" : "Signing in…") : mode === "reset" ? "Send reset link" : "Sign in"}
          </button>

          {mode === "reset" && (
            <button
              type="button"
              className="w-full btn-secondary py-3"
              onClick={() => {
                setMode("login");
                setError("");
                setOk("");
              }}
            >
              Back to sign in
            </button>
          )}
        </form>

        <div className="mt-5 text-xs text-slate-500 leading-relaxed">
          Accounts are <span className="font-bold">invite-only</span>. If you don’t have access yet, ask your admin to invite you.
        </div>
      </div>
    </div>
  );
};

const PasswordRecoveryScreen = ({ onUpdatePassword, onCancel }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await onUpdatePassword(password);
      setOk("Password updated successfully. You can continue to the app.");
    } catch (err) {
      setError(normalizeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md surface p-7 shadow-elevated">
        <div className="flex items-center gap-3">
          <BrandMark size={34} />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{BRAND.name}</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">Set a new password</div>
            <div className="text-sm text-slate-500 mt-1">This link was generated from “Forgot password”.</div>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-3"
              placeholder="Min 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full py-3"
              placeholder="Repeat password"
              autoComplete="new-password"
              required
            />
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-bold">{error}</div>}
          {ok && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-bold">{ok}</div>}

          <div className="flex gap-2">
            <button type="button" className="flex-1 btn-secondary py-3" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="flex-1 btn-primary py-3">
              {busy ? "Saving…" : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function BackendApp() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session || null);
      setAuthReady(true);
    };

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (_event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
      setSession(newSession);
    });

    return () => {
      cancelled = true;
      sub.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) {
      setProfile(null);
      setProfileReady(true);
      return;
    }

    setProfileReady(false);
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,email,full_name,role")
        .eq("user_id", session.user.id)
        .single();

      if (cancelled) return;
      if (error) {
        setProfile(null);
      } else {
        setProfile(data);
      }
      setProfileReady(true);
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const role = useMemo(() => profile?.role || "staff", [profile?.role]);

  if (!authReady) return <LoadingScreen label="Starting…" />;
  if (recoveryMode && session) {
    return (
      <PasswordRecoveryScreen
        onUpdatePassword={async (newPassword) => {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          setRecoveryMode(false);
        }}
        onCancel={async () => {
          setRecoveryMode(false);
          await supabase.auth.signOut();
        }}
      />
    );
  }
  if (!session)
    return (
      <LoginScreen
        onLogin={async (email, password) => {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }}
        onResetPassword={async (email) => {
          const origin = (() => {
            try {
              return window.location.origin;
            } catch {
              return "";
            }
          })();
          const redirectTo = origin && /^https?:\/\//.test(origin) ? origin : undefined;
          const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
          if (error) throw error;
        }}
      />
    );
  if (!profileReady) return <LoadingScreen label="Loading your account…" />;

  return (
    <LirasApp
      backend={{
        enabled: true,
        supabase,
        user: session.user,
        role,
        profile,
        onLogout: () => supabase.auth.signOut(),
      }}
    />
  );
}
