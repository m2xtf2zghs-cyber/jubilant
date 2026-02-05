import React, { useEffect, useMemo, useState } from "react";
import LirasApp from "../LirasApp.jsx";
import { supabase } from "./supabaseClient.js";

const LoadingScreen = ({ label = "Loading…" }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="text-lg font-bold text-slate-900">{label}</div>
      <div className="text-sm text-slate-500 mt-1">Jubilant LIRAS</div>
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="text-2xl font-extrabold text-slate-900">Jubilant Enterprises</div>
        <div className="text-sm text-slate-500 mt-1">Sign in to access LIRAS v4.06</div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg"
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
              className="w-full p-3 border rounded-lg"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="text-sm text-red-600 font-bold">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className={`w-full py-3 rounded-lg font-bold text-white ${busy ? "bg-slate-400" : "bg-slate-900 hover:bg-black"}`}
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
