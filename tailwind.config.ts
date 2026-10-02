import type { Config } from "tailwindcss";

// Colors and fonts match the Campeos design mockups (canvas artifact:
// "Campeos: dashboard states and campaign builder").
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: "#F5F1E8",
        slate: "#1C1B18",
        clay: "#C2410C",
        line: "#E8E2D3",
        muted: "#5C584D",
        faint: "#8F897A",
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
