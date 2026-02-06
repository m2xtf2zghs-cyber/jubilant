import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Capacitor iOS/Android loads assets from a local file URL; relative paths avoid 404s.
const BUILD_TIME = new Date().toISOString();
let GIT_SHA = "";
try {
  GIT_SHA = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  // ignore (e.g. Netlify builds without git metadata)
}

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __GIT_SHA__: JSON.stringify(GIT_SHA),
  },
});
