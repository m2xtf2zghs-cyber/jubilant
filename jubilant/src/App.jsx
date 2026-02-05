import React from "react";
import LirasApp from "./LirasApp.jsx";
import BackendApp from "./backend/BackendApp.jsx";
import { isSupabaseConfigured } from "./backend/supabaseClient.js";

export default function App() {
  return isSupabaseConfigured ? <BackendApp /> : <LirasApp />;
}
