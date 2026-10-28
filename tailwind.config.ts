import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        royal: "#2B3A8F",
        navy: "#0E1B3D",
        accent: { DEFAULT: "#E8641E", dark: "#C9520F" },
        gold: "#D4A94F",
        cream: "#FAF8F5",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(14,27,61,0.18)",
        ticket: "0 24px 60px -20px rgba(14,27,61,0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
