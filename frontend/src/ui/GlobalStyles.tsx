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
        /* Display tier — reserved for hero headlines, the brand mark, and
           oversized numerals. Pairs a refined Chinese calligraphic serif
           (XiaoWei) with a classical Latin serif (Cormorant) so mixed-script
           headlines share one voice. */
        --font-display: "ZCOOL XiaoWei", "Cormorant Garamond", "Noto Serif SC", serif;

        /* Radius scale — use tokens over raw numbers so shapes stay in sync. */
        --radius-xs: 8px;   /* chips, inline badges */
        --radius-sm: 12px;  /* inputs, small buttons */
        --radius-md: 14px;  /* tile/logo blocks */
        --radius-lg: 18px;  /* cards */
        --radius-xl: 22px;  /* hero cards, sheets */
        --radius-pill: 999px;

        /* Elevation — one silhouette per tier, tinted warm so shadows sit
           on the paper rather than looking charcoal on cream. */
        --shadow-1: 0 2px 8px rgba(120, 90, 10, 0.10);
        --shadow-2: 0 8px 22px rgba(120, 90, 10, 0.16);
        --shadow-3: 0 14px 34px rgba(200, 160, 0, 0.32);
        --shadow-inset-hi: inset 0 1px 0 rgba(255, 255, 255, 0.55);

        /* Spacing — 4px grid, named by role rather than size. */
        --space-1: 4px;
        --space-2: 8px;
        --space-3: 12px;
        --space-4: 16px;
        --space-5: 20px;
        --space-6: 24px;
        --space-8: 32px;

        /* Type scale — fluid clamps keyed off the mobile viewport so the
           scale stays balanced on narrow phones and edge-case tablets. */
        --text-xs: clamp(10px, 2.8vw, 11px);
        --text-sm: clamp(12px, 3.2vw, 13px);
        --text-base: clamp(13px, 3.6vw, 14px);
        --text-md: clamp(14px, 4vw, 16px);
        --text-lg: clamp(16px, 4.6vw, 18px);
        --text-xl: clamp(20px, 5.4vw, 22px);
        --text-2xl: clamp(24px, 7vw, 28px);
        --text-display: clamp(40px, 12vw, 52px);
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
        padding: 0 var(--space-4);
        border-radius: var(--radius-sm);
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
      /* One deliberate "moment" — a sheen that sweeps diagonally across the
         gold Points card on mount, then loops every 7s. Kept subtle enough
         that it reads as living material, not a distracting banner. */
      @keyframes sheenSweep {
        0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
        8%   { opacity: 1; }
        40%  { transform: translateX(220%) skewX(-18deg); opacity: 0; }
        100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ga-sheen { animation: none !important; }
      }
    `}</style>
  );
}
