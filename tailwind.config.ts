import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // --- Existing custom theme tokens (unchanged) ---
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        panel2: "rgb(var(--c-panel2) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        ok: "rgb(var(--c-ok) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        accent1: "rgb(var(--c-accent-1) / <alpha-value>)",
        accent2: "rgb(var(--c-accent-2) / <alpha-value>)",
        accent3: "rgb(var(--c-accent-3) / <alpha-value>)",
        info: "rgb(var(--c-info) / <alpha-value>)",
        success: "rgb(var(--c-success) / <alpha-value>)",
        warning: "rgb(var(--c-warning) / <alpha-value>)",

        // --- shadcn/ui semantic tokens, bridged to the custom palette ---
        // `border` doubles as the existing token and shadcn's `border-border`.
        border: "rgb(var(--c-border) / <alpha-value>)",
        input: "rgb(var(--c-border) / <alpha-value>)",
        ring: "rgb(var(--c-primary) / <alpha-value>)",
        background: "rgb(var(--c-bg) / <alpha-value>)",
        foreground: "rgb(var(--c-text) / <alpha-value>)",
        // Objects below keep their previous flat usage working via DEFAULT
        // (e.g. text-primary, bg-destructive, text-muted) while adding the
        // *-foreground variants shadcn components expect.
        primary: {
          DEFAULT: "rgb(var(--c-primary) / <alpha-value>)",
          foreground: "rgb(var(--c-bg) / <alpha-value>)"
        },
        secondary: {
          DEFAULT: "rgb(var(--c-panel2) / <alpha-value>)",
          foreground: "rgb(var(--c-text) / <alpha-value>)"
        },
        destructive: {
          DEFAULT: "rgb(var(--c-destructive) / <alpha-value>)",
          foreground: "rgb(var(--c-panel) / <alpha-value>)"
        },
        muted: {
          // DEFAULT stays the grey text color so existing `text-muted` is unchanged.
          DEFAULT: "rgb(var(--c-muted) / <alpha-value>)",
          foreground: "rgb(var(--c-muted) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "rgb(var(--c-panel2) / <alpha-value>)",
          foreground: "rgb(var(--c-text) / <alpha-value>)"
        },
        popover: {
          DEFAULT: "rgb(var(--c-panel) / <alpha-value>)",
          foreground: "rgb(var(--c-text) / <alpha-value>)"
        },
        card: {
          DEFAULT: "rgb(var(--c-panel) / <alpha-value>)",
          foreground: "rgb(var(--c-text) / <alpha-value>)"
        }
      },
      borderRadius: {
        // Hairline/Swiss redesign: the whole radius scale is collapsed to a
        // near-sharp range so existing `rounded-xl`/`rounded-2xl`/`rounded-lg`
        // literals across the app flatten in one place — no need to touch every
        // className. `full` is kept for genuine pills/avatars/spinners only.
        none: "0px",
        sm: "1px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "3px",
        "2xl": "4px",
        "3xl": "4px",
        full: "9999px"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
