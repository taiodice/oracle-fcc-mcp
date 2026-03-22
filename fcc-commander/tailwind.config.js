/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--color-primary)",
          "primary-light": "var(--color-primary-light)",
          accent: "var(--color-accent)",
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          error: "var(--color-error)",
          surface: "var(--color-surface)",
          sidebar: "var(--color-sidebar)",
          "sidebar-text": "var(--color-sidebar-text)",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Inter", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
