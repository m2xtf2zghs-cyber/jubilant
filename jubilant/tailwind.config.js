/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 30px rgba(15, 23, 42, 0.08)",
        elevated: "0 2px 6px rgba(15, 23, 42, 0.08), 0 30px 80px rgba(15, 23, 42, 0.16)",
      },
    },
  },
  plugins: [],
};
