import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        retro: {
          bg: "#f0f0f0",
          dark: "#1a1a1a",
          primary: "#FF6B6B", // Red/Pink
          secondary: "#4ECDC4", // Teal
          accent: "#FFE66D", // Yellow
          border: "#000000",
        },
        brand: {
          50: "#f5f8ff",
          100: "#ebf2ff",
          200: "#d6e4ff",
          300: "#adccff",
          400: "#7aa7ff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#1e3a8a",
        },
      },
      boxShadow: {
        retro: "4px 4px 0px 0px #000000",
        "retro-hover": "2px 2px 0px 0px #000000",
      },
      animation: {
        marquee: "marquee 25s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
