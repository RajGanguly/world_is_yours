import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#0a0d12",
        panel: "#10141c",
        line: "#1e2530",
        signal: "#e8b04b",
        signalDim: "#8a6a2e",
        wire: "#3d5a73",
        mist: "#8b95a5",
        fog: "#c7cdd6",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(ellipse at center, rgba(232,176,75,0.06) 0%, rgba(10,13,18,0) 60%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scan: "scan 2.4s linear infinite",
      },
      keyframes: {
        scan: {
          "0%": { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "0% 200%" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
