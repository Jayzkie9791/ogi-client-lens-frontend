/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--cl-color-canvas)",
        surface: "var(--cl-color-surface)",
        elevated: "var(--cl-color-elevated)",
        border: "var(--cl-color-border)",
        primary: {
          navy: "var(--cl-color-primary-navy)",
          blue: "var(--cl-color-primary-blue)"
        },
        accent: {
          red: "var(--cl-color-accent-red)"
        },
        text: {
          primary: "var(--cl-color-text-primary)",
          muted: "var(--cl-color-text-muted)",
          inverse: "var(--cl-color-text-inverse)"
        },
        state: {
          success: "var(--cl-color-success)",
          warning: "var(--cl-color-warning)",
          error: "var(--cl-color-error)",
          info: "var(--cl-color-info)"
        },
        focus: "var(--cl-color-focus)"
      },
      borderRadius: {
        component: "var(--cl-radius-component)",
        panel: "var(--cl-radius-panel)"
      },
      fontFamily: {
        sans: "var(--cl-font-sans)"
      },
      boxShadow: {
        panel: "var(--cl-shadow-panel)"
      }
    }
  },
  plugins: []
};
