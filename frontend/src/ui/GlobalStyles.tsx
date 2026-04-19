export default function GlobalStyles() {
  return (
    <style>{`
      :root {
        /* Neutrals */
        --bg: #FFFDF5;
        --bg-shell: #F2ECDC;
        --fg: #241c00;
        --muted: rgba(50, 40, 0, 0.6);
        --card: rgba(255, 255, 255, 0.7);
        --card-strong: rgba(255, 255, 255, 0.9);

        /* Gold scale — primary brand */
        --gold-pale: #fee99a;
        --gold-light: #fed234;
        --gold: #fec701;
        --gold-deep: #cb9f01;
        --gold-dark: #987701;
        --gold-darkest: #655001;

        /* Accent — community */
        --green: #8AD4B0;
        --green-deep: #4EA886;

        /* Accent — milestone */
        --purple: #B8A4E3;
        --purple-deep: #8D71C7;

        /* Accent — pioneer */
        --peach: #FFC170;
        --peach-deep: #F39770;

        /* Typography */
        --font-sans: "Noto Sans SC", "PingFang SC", -apple-system, sans-serif;
        --font-serif: "Noto Serif SC", serif;
      }
      html, body { margin: 0; padding: 0; background: var(--bg-shell); }
      * { box-sizing: border-box; }

      /* Focus rings — keyboard-only via :focus-visible */
      button, [role="button"], a, input, textarea, select { outline: none; }
      button:focus-visible, [role="button"]:focus-visible, [tabindex="0"]:focus-visible, a:focus-visible {
        outline: 2px solid var(--gold-deep);
        outline-offset: 2px;
      }

      /* Shared form-field base — inputs & textareas */
      .ga-input {
        width: 100%;
        padding: 0 14px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.85);
        color: var(--fg);
        font-family: inherit;
        box-sizing: border-box;
        border: 1px solid rgba(254, 210, 52, 0.4);
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .ga-input:focus-visible {
        outline: none;
        border-color: var(--gold-deep);
        box-shadow: 0 0 0 3px rgba(254, 199, 1, 0.25);
      }
      .news-track::-webkit-scrollbar, .rw-hscroll::-webkit-scrollbar { display: none; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes bobble { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      @keyframes sparklePulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.95); opacity: 0.85; } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    `}</style>
  );
}
