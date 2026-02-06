import React, { useEffect, useMemo, useState } from "react";
import LirasApp from "../LirasApp.jsx";
import { supabase } from "./supabaseClient.js";
import { BRAND } from "../brand/Brand.jsx";

const LoadingScreen = ({ label = "Loading…" }) => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="w-full max-w-md surface p-6">
      <div className="text-lg font-extrabold text-slate-900">{label}</div>
      <div className="text-sm text-slate-500 mt-1">Jubilant LIRAS v4.06</div>
    </div>
  </div>
);

const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md surface p-7 shadow-elevated">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{BRAND.name}</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">
              Sign in to{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">LIRAS v4.06</span>
            </div>
            <div className="text-sm text-slate-500 mt-1">Invite-only access for staff accounts</div>
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
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Password</label>
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

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-bold">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-soft transition ${
              busy ? "bg-slate-400" : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            }`}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 text-xs text-slate-500 leading-relaxed">
          Accounts are <span className="font-bold">invite-only</span>. If you don’t have access yet, ask your admin to invite you.
        </div>
      </div>
    </div>
  );
};

export default function BackendApp() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

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
  if (!session)
    return (
      <LoginScreen
        onLogin={async (email, password) => {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
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
