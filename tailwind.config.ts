import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#111923",
        card: "#1a222c",
        line: "#2d3846",
        muted: "#8b9aab",
        accent: "#3d9cf5",
        up: "#34d399",
        down: "#f87171",
      },
    },
  },
  plugins: [],
};
export default config;
