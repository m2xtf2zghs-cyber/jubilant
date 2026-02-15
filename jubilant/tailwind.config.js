/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.06)",
        elevated: "0 1px 2px rgba(15, 23, 42, 0.08), 0 10px 25px rgba(15, 23, 42, 0.10)",
      },
    },
  },
  plugins: [],
};
