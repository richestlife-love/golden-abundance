export default function GlobalStyles() {
  return (
    <style>{`
      html, body { margin: 0; padding: 0; background: #f2ecdc; }
      * { box-sizing: border-box; }
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
