import type { Config } from "tailwindcss";

// Cloudflare-style structure (white/cool-gray base, hairline borders,
// restrained layout) with a violet→pink brand instead of green — this
// supersedes the green "liquid-steps" logo decision (Oct 2026): per
// Ajay, purple/pink is the deliberate category signal for an AI
// copywriting tool (Jasper, Copy.ai and most of that category lean
// purple specifically because it reads as "AI/creative" without being
// the generic SaaS blue every competitor, including ActiveCampaign,
// already uses). "lime" is kept only for the agent's literal "online"
// status dot — a universal green-means-active convention, not a second
// brand color — everywhere else there's exactly one accent.
// Old token names (ivory, slate, clay, line, muted, faint) are kept so
// existing className usage across components didn't all need rewriting —
// only what each name POINTS TO changed.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",       // main app background
        ivory: "#F6F7F5",       // subtle panel/surface background
        slate: "#13171A",       // primary text — stays near-black
        clay: "#7C3AED",        // primary brand accent — violet (was deep green)
        pink: "#EC4899",        // paired with clay for the gradient treatment
        lime: "#22C55E",        // ONLY the online-status dot — not a brand color
        line: "#E3E6E1",        // hairline borders
        muted: "#5B6560",       // secondary text
        faint: "#8A9089",       // tertiary text / placeholders
        agent: "#7C3AED",       // same as "clay" — one brand color, not a second accent
        agentWash: "#F4EEFE",   // light brand-tinted wash for agent surfaces
        warnBg: "#FCEFC7",
        warnFg: "#7A4B00",
        dangerFg: "#B42318",
      },
      fontFamily: {
        // One family, varying weight — no separate display face. DM Mono
        // stays for timestamps, counts and other data-shaped labels.
        display: ["DM Sans", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      // Added for the marketing page (app/page.tsx) — the rest of the app
      // sticks to Tailwind's built-in animate-pulse/animate-spin, but the
      // hero's drifting background orbs and the final CTA's moving
      // gradient need their own keyframes. Kept here (not inline <style>)
      // so they're ordinary Tailwind utility classes like everything else.
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(-30px,24px) scale(1.06)" },
        },
        drift2: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(26px,-20px) scale(1.08)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "gradient-move": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        drift: "drift 13s ease-in-out infinite",
        drift2: "drift2 15s ease-in-out infinite",
        floaty: "floaty 5s ease-in-out infinite",
        "gradient-move": "gradient-move 10s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
