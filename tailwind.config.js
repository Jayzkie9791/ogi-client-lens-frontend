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
          label: "var(--cl-color-text-label)",
          subtle: "var(--cl-color-text-subtle)",
          inverse: "var(--cl-color-text-inverse)"
        },
        workspace: {
          canvas: "var(--cl-workspace-canvas)",
          panel: "var(--cl-workspace-panel)",
          border: "var(--cl-workspace-border)",
          divider: "var(--cl-workspace-divider)"
        },
        sidebar: {
          parent: "var(--cl-sidebar-parent-text)",
          "parent-active": "var(--cl-sidebar-parent-active)",
          child: "var(--cl-sidebar-child-text)",
          "child-rail": "var(--cl-sidebar-child-rail)",
          active: "var(--cl-sidebar-active)",
          "active-bg": "var(--cl-sidebar-active-bg)"
        },
        document: {
          title: "var(--cl-document-title)",
          "title-hover": "var(--cl-document-title-hover)"
        },
        evidence: {
          draft: "var(--cl-evidence-draft)",
          "draft-bg": "var(--cl-evidence-draft-bg)",
          review: "var(--cl-evidence-review)",
          "review-bg": "var(--cl-evidence-review-bg)",
          approved: "var(--cl-evidence-approved)",
          "approved-bg": "var(--cl-evidence-approved-bg)",
          exception: "var(--cl-evidence-exception)",
          "exception-bg": "var(--cl-evidence-exception-bg)"
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
        panel: "var(--cl-shadow-panel)",
        workspace: "var(--cl-workspace-shadow)"
      },
      letterSpacing: {
        heading: "var(--cl-type-heading-tracking)",
        label: "var(--cl-type-label-tracking)"
      }
    }
  },
  plugins: []
};
