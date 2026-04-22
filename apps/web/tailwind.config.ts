import type { Config } from "tailwindcss";

/**
 * Raycast-inspired design tokens. Dark-first, near-black surfaces, a single
 * cool blue accent, Geist Sans body + Geist Mono for codes and filenames.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        base: "#0a0a0b",
        surface: {
          DEFAULT: "#141416",
          elevated: "#1c1c1f",
          hover: "#22222a",
        },
        // Borders and dividers
        line: "rgba(255,255,255,0.06)",
        "line-strong": "rgba(255,255,255,0.12)",
        // Text
        fg: {
          DEFAULT: "#fafafa",
          muted: "#9a9aa0",
          subtle: "#6a6a70",
          dim: "#48484e",
        },
        // Accent (technical blue — trustworthy for HSE context)
        accent: {
          DEFAULT: "#4f8cff",
          hover: "#6b9fff",
          dim: "#2a4d8f",
          subtle: "rgba(79,140,255,0.1)",
        },
        // Semantic
        success: {
          DEFAULT: "#4ade80",
          subtle: "rgba(74,222,128,0.1)",
        },
        warning: {
          DEFAULT: "#fbbf24",
          subtle: "rgba(251,191,36,0.1)",
        },
        danger: {
          DEFAULT: "#f87171",
          subtle: "rgba(248,113,113,0.1)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        xxs: ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        card: "12px",
        pill: "999px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(79,140,255,0.4), 0 8px 32px rgba(79,140,255,0.15)",
        "glow-success": "0 0 0 1px rgba(74,222,128,0.4), 0 4px 16px rgba(74,222,128,0.12)",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-in": "slideIn 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
