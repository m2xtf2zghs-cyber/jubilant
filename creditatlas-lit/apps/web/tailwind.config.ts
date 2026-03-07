import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f3f5ef",
        ink: "#1f2a2c",
        accent: "#126f5c",
        caution: "#b55f17",
        alert: "#9b2626"
      },
      boxShadow: {
        cockpit: "0 14px 40px rgba(18, 111, 92, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
