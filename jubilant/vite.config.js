import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Capacitor iOS/Android loads assets from a local file URL; relative paths avoid 404s.
export default defineConfig({
  base: "./",
  plugins: [react()],
});

