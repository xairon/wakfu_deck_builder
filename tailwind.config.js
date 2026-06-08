/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#1B1A17", muted: "#6B6862", faint: "#A6A29A" },
        paper: { DEFAULT: "#F6F5F1", 200: "#EDEBE4", 300: "#DFDCD2" },
        // Accent braise (énergie Wakfu) — un seul accent dominant
        ember: "#F04E22",
        // Les 5 éléments dans les couleurs vives du jeu
        element: {
          air: "#5FB22A",
          eau: "#1F9CEC",
          feu: "#F04E22",
          terre: "#F0A62B",
          neutre: "#98A1AF",
        },
      },
      fontFamily: {
        // Corps / UI = sans moderne
        sans: ["'Hanken Grotesk'", "system-ui", "sans-serif"],
        // Noms & titres
        display: ["Fraunces", "Georgia", "serif"],
        // Tous les nombres & libellés système
        mono: ["'Space Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      boxShadow: {
        // Une seule ombre permise : le pressage du sceau
        seal: "0 1px 0 rgba(26,23,20,0.25)",
      },
      animation: {
        "ink-settle": "inkSettle 0.18s cubic-bezier(0.2,0.7,0.2,1) both",
        "seal-stamp": "sealStamp 0.24s cubic-bezier(0.2,0.7,0.2,1) both",
      },
      keyframes: {
        inkSettle: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        sealStamp: {
          "0%": { transform: "scale(1.08) rotate(-4deg)", opacity: "0" },
          "100%": { transform: "scale(1) rotate(-3deg)", opacity: "1" },
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    logs: false,
    themes: [
      {
        // ── Parchemin (clair, signature, défaut) ──
        light: {
          "color-scheme": "light",
          primary: "#F04E22",
          "primary-content": "#FFFFFF",
          secondary: "#1B1A17",
          "secondary-content": "#F6F5F1",
          accent: "#F04E22",
          "accent-content": "#FFFFFF",
          neutral: "#1B1A17",
          "neutral-content": "#F6F5F1",
          "base-100": "#F6F5F1",
          "base-200": "#EDEBE4",
          "base-300": "#DFDCD2",
          "base-content": "#1B1A17",
          info: "#1F9CEC",
          "info-content": "#FFFFFF",
          success: "#2FA15A",
          "success-content": "#FFFFFF",
          warning: "#E0931C",
          "warning-content": "#FFFFFF",
          error: "#E23B22",
          "error-content": "#FFFFFF",
          "--rounded-box": "0.125rem",
          "--rounded-btn": "0.125rem",
          "--rounded-badge": "0",
          "--tab-radius": "0",
          "--border-btn": "1px",
          "--animation-btn": "0.12s",
        },
      },
      {
        // ── Grimoire de nuit (encre) ──
        dark: {
          "color-scheme": "dark",
          primary: "#F4612E",
          "primary-content": "#131316",
          secondary: "#ECEAE4",
          "secondary-content": "#131316",
          accent: "#F4612E",
          "accent-content": "#131316",
          neutral: "#ECEAE4",
          "neutral-content": "#131316",
          "base-100": "#131316",
          "base-200": "#1B1B20",
          "base-300": "#26262C",
          "base-content": "#ECEAE4",
          info: "#34A6F2",
          "info-content": "#131316",
          success: "#46C277",
          "success-content": "#131316",
          warning: "#F0B33C",
          "warning-content": "#131316",
          error: "#F0573A",
          "error-content": "#131316",
          "--rounded-box": "0.125rem",
          "--rounded-btn": "0.125rem",
          "--rounded-badge": "0",
          "--tab-radius": "0",
          "--border-btn": "1px",
          "--animation-btn": "0.12s",
        },
      },
    ],
    darkTheme: "dark",
  },
};
