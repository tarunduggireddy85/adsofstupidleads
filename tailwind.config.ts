import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#11141b",
        border: "#1f2430",
        muted: "#7a8499",
        accent: "#22d3ee",
      },
    },
  },
  plugins: [],
};
export default config;
