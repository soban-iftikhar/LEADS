import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0D0D0D",
        accent: {
          DEFAULT: "#F97316",
          hover: "#EA6C0A",
        },
        background: "#F8F8F8",
        surface: "#FFFFFF",
        border: "#E5E5E5",
        "text-primary": "#0D0D0D",
        "text-secondary": "#6B7280",
        "text-muted": "#9CA3AF",
        success: "#22C55E",
        "success-light": "#F0FDF4",
        warning: "#F59E0B",
        "warning-light": "#FFFBEB",
        error: "#EF4444",
        "error-light": "#FEF2F2",
        sidebar: "#0D0D0D",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.10)",
        dropdown: "0 4px 16px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
