// React app page — 金富有志工
// Full-viewport mobile-app landing. No device frame. Responsive, CTA always visible.

const { useState, useEffect, useRef, useMemo } = React;

// ─── Global styles ────────────────────────────────────────────
function GlobalStyles() {
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

// ─── Background ───────────────────────────────────────────────
function PaperBackground() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#FFFDF5" }} />
  );
}

// ─── Hero ─────────────────────────────────────────────────────
function MascotHero({ size }) {
  const s = size; // diameter of the halo
  return (
    <div
      style={{
        position: "relative",
        width: s,
        height: s,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: s * 1.05,
          height: s * 1.05,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,220,240,0.9) 0%, rgba(220,220,255,0.5) 40%, transparent 70%)",
          filter: "blur(10px)",
        }}
      />
      {/* White core glow — brighter center behind mascot */}
      <div
        style={{
          position: "absolute",
          width: s * 0.95,
          height: s * 0.95,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 20%, rgba(255,250,235,0.5) 45%, transparent 70%)",
          filter: "blur(14px)",
          mixBlendMode: "normal",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: s * 0.55,
          height: s * 0.55,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.7) 40%, transparent 75%)",
          filter: "blur(8px)",
        }}
      />
      <svg
        width={s * 1.05}
        height={s * 1.05}
        style={{ position: "absolute", animation: "spin 30s linear infinite" }}
      >
        <circle
          cx="50%"
          cy="50%"
          r={s * 0.48}
          fill="none"
          stroke="rgba(254,210,52,0.5)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
      </svg>
      <img
        src={`assets/mascot-halfbody.png?v=1`}
        style={{
          width: Math.min(s * 1.15, 560),
          height: Math.min(s * 1.05, 520),
          objectFit: "contain",
          objectPosition: "center bottom",
          position: "relative",
          marginBottom: -s * 0.05,
          filter: "drop-shadow(0 8px 20px rgba(100,80,1,0.18))",
          animation: "bobble 4.5s ease-in-out infinite",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 82%, rgba(0,0,0,0.6) 92%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 82%, rgba(0,0,0,0.6) 92%, transparent 100%)",
        }}
      />
      <SparkleGlyph x="8%" y="12%" size={s * 0.07} color="#fedd67" delay={0} />
      <SparkleGlyph
        x="88%"
        y="8%"
        size={s * 0.085}
        color="#fed234"
        delay={0.8}
      />
      <SparkleGlyph
        x="92%"
        y="76%"
        size={s * 0.055}
        color="#fedd67"
        delay={1.6}
      />
      <SparkleGlyph
        x="4%"
        y="68%"
        size={s * 0.065}
        color="#fee99a"
        delay={2.2}
      />
    </div>
  );
}

function SparkleGlyph({ x, y, size = 18, color = "#fff", delay = 0 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: x,
        top: y,
        animation: `sparklePulse 2.8s ease-in-out ${delay}s infinite`,
        filter: `drop-shadow(0 0 6px ${color})`,
      }}
    >
      <path
        d="M12,1 L13.5,10.5 L23,12 L13.5,13.5 L12,23 L10.5,13.5 L1,12 L10.5,10.5 Z"
        fill={color}
      />
    </svg>
  );
}

// ─── Headline ─────────────────────────────────────────────────
function Headline({ text, fontSize }) {
  return (
    <div
      style={{
        textAlign: "center",
        lineHeight: 1,
        fontSize,
        fontWeight: 900,
        letterSpacing: 2,
        fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
        background: "linear-gradient(180deg, #cb9f01 0%, #987701 55%, #655001 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 2px 4px rgba(254,199,1,0.45))",
        color: "rgb(203, 159, 1)",
      }}
    >
      {text}
    </div>
  );
}

// ─── CTA Button ───────────────────────────────────────────────
function GradientButton({ label, onClick }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: "100%",
        height: 60,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background:
          "linear-gradient(135deg, #fed234 0%, #fec701 45%, #fec701 100%)",
        color: "#fff",
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 4,
        fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
        boxShadow: pressed
          ? "0 4px 12px rgba(254,199,1,0.4), inset 0 2px 6px rgba(0,0,0,0.1)"
          : "0 12px 30px rgba(254,199,1,0.5), 0 4px 10px rgba(254,210,52,0.35), inset 0 1px 0 rgba(255,255,255,0.5)",
        transition: "all 0.15s ease",
        transform: pressed ? "translateY(1px) scale(0.985)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span style={{ position: "relative", zIndex: 2 }}>{label}</span>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.35), transparent)",
          borderRadius: "999px 999px 0 0",
        }}
      />
    </button>
  );
}

// ─── Launch overlay ───────────────────────────────────────────
function LaunchOverlay({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        background:
          "radial-gradient(circle at 50% 50%, rgba(255,249,230,0.97) 0%, rgba(254,221,103,0.97) 50%, rgba(254,210,52,0.97) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 24,
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          border: "4px solid rgba(254,199,1,0.2)",
          borderTopColor: "#fec701",
          animation: "spin 1s linear infinite",
        }}
      />
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 6,
          fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
          color: "#987701",
        }}
      >
        启航中…
      </div>
    </div>
  );
}

// ─── Landing screen ───────────────────────────────────────────
function LandingScreen({ onStart }) {
  const getInitial = () => {
    const w = Math.min(
      typeof window !== "undefined" ? window.innerWidth : 390,
      440,
    );
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return { w: w || 390, h: h || 800 };
  };
  const [dims, setDims] = useState(getInitial);
  const rootRef = useRef(null);

  useEffect(() => {
    const update = () => {
      if (rootRef.current) {
        const r = rootRef.current.getBoundingClientRect();
        // guard against zero readings before layout has settled
        if (r.width > 0 && r.height > 0) {
          setDims({ w: r.width, h: r.height });
        }
      }
    };
    // measure on next frame AND after a tick, so layout has settled
    const raf = requestAnimationFrame(update);
    const t = setTimeout(update, 80);
    let ro;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      ro = new ResizeObserver(update);
      ro.observe(rootRef.current);
    }
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Responsive scaling based on viewport, with sensible floors
  const short = Math.max(Math.min(dims.w || 390, 440), 280);
  const tall = Math.max(dims.h || 800, 520);
  const heroSize = Math.max(Math.min(short * 0.9, tall * 0.48, 480), 200);
  const titleSize = Math.max(Math.min(short * 0.115, tall * 0.055, 46), 28);

  return (
    <div
      ref={rootRef}
      data-screen-label="Landing"
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        color: "#241c00",
      }}
    >
      <PaperBackground />

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "6px 28px 24px",
          minHeight: 0,
        }}
      >
        {/* Brand chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: 0.85,
            animation: "fadeInDown 0.8s ease",
            paddingTop: 4,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "linear-gradient(135deg, #fed234, #fec701)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(254,199,1,0.3)",
            }}
          >
            <span
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: 900,
                fontFamily: '"Noto Serif SC", serif',
              }}
            >
              金
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 2,
              color: "#987701",
              fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
            }}
          >
            金富有 · GOLDEN ABUNDANCE
          </span>
        </div>

        {/* Hero */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
            animation: "fadeInUp 0.9s 0.1s ease backwards",
          }}
        >
          <MascotHero size={heroSize} />
        </div>

        {/* Headline */}
        <div
          style={{
            animation: "fadeInUp 0.9s 0.25s ease backwards",
            flexShrink: 0,
          }}
        >
          <Headline text="金富有志工" fontSize={titleSize} />
        </div>

        {/* Subtitle */}
        <div
          style={{
            textAlign: "center",
            marginTop: 14,
            marginBottom: 22,
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: 4,
            color: "#987701",
            fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
            animation: "fadeInUp 0.9s 0.4s ease backwards",
            flexShrink: 0,
          }}
        >
          成就屬於自己的光明宇宙
        </div>

        {/* CTA */}
        <div
          style={{
            animation: "fadeInUp 0.9s 0.55s ease backwards",
            flexShrink: 0,
          }}
        >
          <GradientButton label="开启" onClick={onStart} />
        </div>
      </div>

    </div>
  );
}

// ─── Google Auth Screen ───────────────────────────────────────
function GoogleAuthScreen({ onCancel, onSuccess }) {
  // Stages: 'chooser' -> 'loading' -> success
  const [stage, setStage] = useState("chooser");
  const [selected, setSelected] = useState(null);

  const accounts = [
    { name: "陈志明", email: "chen.zhiming@gmail.com", avatar: "#fed234" },
    { name: "林佳怡", email: "lin.jiayi@gmail.com", avatar: "#fec701" },
  ];

  const pickAccount = (a) => {
    setSelected(a);
    setStage("loading");
    setTimeout(() => onSuccess(a), 1800);
  };

  const useAnother = () => {
    setSelected({ name: "你", email: "you@gmail.com", avatar: "#fec701" });
    setStage("loading");
    setTimeout(
      () =>
        onSuccess({ name: "你", email: "you@gmail.com", avatar: "#fec701" }),
      1800,
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "8px 0 24px",
          overflow: "hidden",
        }}
      >
        {/* Google header */}
        <div
          style={{
            padding: "16px 24px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "fadeIn 0.4s ease",
          }}
        >
          <GoogleLogo />
          {stage === "chooser" && (
            <button
              onClick={onCancel}
              style={{
                background: "none",
                border: "none",
                padding: 8,
                margin: -8,
                cursor: "pointer",
                color: "#5F6368",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {stage === "chooser" && (
          <div
            style={{ padding: "24px 28px 0", animation: "fadeInUp 0.4s ease" }}
          >
            <h1
              style={{
                fontFamily: '"Google Sans", "Noto Sans SC", sans-serif',
                fontSize: 24,
                fontWeight: 400,
                color: "#202124",
                margin: "0 0 6px",
                lineHeight: 1.3,
              }}
            >
              选择账号
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "#5F6368",
                margin: "0 0 4px",
                fontFamily: '"Google Sans", "Noto Sans SC", sans-serif',
              }}
            >
              继续前往 <span style={{ color: "#1A73E8" }}>金富有志工</span>
            </p>
          </div>
        )}

        {stage === "chooser" && (
          <div
            style={{
              margin: "28px 16px 0",
              borderRadius: 8,
              border: "1px solid #DADCE0",
              overflow: "hidden",
              animation: "fadeInUp 0.5s 0.1s ease backwards",
            }}
          >
            {accounts.map((a, i) => (
              <div
                key={a.email}
                onClick={() => pickAccount(a)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid #DADCE0",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#F8F9FA")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${a.avatar}, ${a.avatar}DD)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {a.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ fontSize: 14, color: "#202124", fontWeight: 500 }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#5F6368",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.email}
                  </div>
                </div>
              </div>
            ))}
            <div
              onClick={useAnother}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#F8F9FA")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid #DADCE0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#5F6368",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="#5F6368"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div style={{ fontSize: 14, color: "#202124" }}>使用其他账号</div>
            </div>
          </div>
        )}

        {stage === "chooser" && (
          <div
            style={{
              padding: "20px 28px 0",
              fontSize: 12,
              color: "#5F6368",
              lineHeight: 1.5,
              animation: "fadeIn 0.6s 0.2s ease backwards",
            }}
          >
            如要继续，Google
            会将您的姓名、邮箱地址、语言偏好设置和个人资料照片分享给"金富有志工"。使用此应用前，请查看"金富有志工"的
            <span style={{ color: "#1A73E8" }}> 隐私权政策</span> 和
            <span style={{ color: "#1A73E8" }}> 服务条款</span>。
          </div>
        )}

        {stage === "loading" && selected && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 32px",
              gap: 20,
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${selected.avatar}, ${selected.avatar}DD)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {selected.name[0]}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#5F6368", marginBottom: 4 }}>
                正在登录…
              </div>
              <div style={{ fontSize: 13, color: "#202124" }}>
                {selected.email}
              </div>
            </div>
            <GoogleSpinner />
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="75" height="24" viewBox="0 0 272 92">
      <path
        fill="#EA4335"
        d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#FBBC05"
        d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#4285F4"
        d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"
      />
      <path fill="#34A853" d="M225 3v65h-9.5V3h9.5z" />
      <path
        fill="#EA4335"
        d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"
      />
      <path
        fill="#4285F4"
        d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"
      />
    </svg>
  );
}

function GoogleSpinner() {
  return (
    <div style={{ width: 28, height: 28, position: "relative" }}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        style={{ animation: "spin 1.4s linear infinite" }}
      >
        <circle
          cx="14"
          cy="14"
          r="11"
          fill="none"
          stroke="#1A73E8"
          strokeWidth="2.5"
          strokeDasharray="30 100"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ─── Tasks data + shared card ─────────────────────────────────
const TASKS = [
  {
    id: 1,
    title: "填寫金富有志工表單",
    due: null,
    daysLeft: null,
    color: "#fec701",
    points: 50,
    tag: "探索",
    bonus: null,
    status: "completed",
    summary: "完成你的志工個人資料，開啟金富有志工旅程。",
    description:
      "歡迎加入金富有志工！請填寫基本個人資料，讓我們了解你的興趣、專長與可投入時段，並協助系統為你推薦合適的任務與團隊。",
    estMinutes: 5,
    steps: [
      { label: "確認電子郵件與手機", done: true },
      { label: "填寫個人興趣與專長", done: true },
      { label: "選擇可投入的時段", done: true },
      { label: "簽署志工服務同意書", done: true },
    ],
  },
  {
    id: 2,
    title: "夏季盛會報名",
    due: "2026-04-30",
    daysLeft: 12,
    color: "#8AD4B0",
    points: 100,
    tag: "社区",
    bonus: "限定紀念徽章",
    status: "in_progress",
    progress: 0.4,
    summary: "為即將到來的夏季盛會報名，鎖定你的服務崗位。",
    description:
      "夏季盛會將於 5 月 10 日舉行，需要大量志工支援現場。完成報名後，你可以選擇服務崗位（接待、導覽、物資、秩序）並與組長對接行前細節。",
    estMinutes: 10,
    steps: [
      { label: "填寫報名表", done: true },
      { label: "選擇服務崗位", done: true },
      { label: "參加行前說明會", done: false },
      { label: "領取志工識別證", done: false },
      { label: "確認當日到場時間", done: false },
    ],
  },
  {
    id: 3,
    title: "組隊挑戰",
    due: "2026-04-30",
    daysLeft: 12,
    color: "#fed234",
    points: 200,
    tag: "陪伴",
    bonus: "金鑰匙紀念筆",
    status: "todo",
    requires: [1, 2],
    cap: 6,
    teamProgress: null,
    isChallenge: true,
    summary: "組建至少 6 人志工團隊，一起挑戰進階任務。",
    description:
      "招募夥伴加入你的團隊（你是隊長），或申請加入朋友的團隊。截止日前團隊成員數達 6 人即可獲得獎勵，人數不設上限。",
    estMinutes: 30,
  },
  {
    id: 4,
    title: "春季志工培訓",
    due: "2026-04-10",
    daysLeft: -8,
    color: "#B8A4E3",
    points: 30,
    tag: "探索",
    bonus: null,
    status: "expired",
    summary: "春季志工基礎培訓，錯過此梯次可於秋季再報名。",
    description:
      "此為每年春季固定舉辦的志工基礎培訓，內容包含志工倫理、安全守則、服務禮儀等。本梯次已於 4 月 10 日結束報名，請留意秋季場次。",
    estMinutes: 90,
    steps: [
      { label: "完成線上報名", done: false },
      { label: "出席培訓課程", done: false },
      { label: "通過結業測驗", done: false },
    ],
  },
];

function getEffectiveStatus(t, allTasks) {
  const completedIds = new Set(
    allTasks.filter((x) => x.status === "completed").map((x) => x.id),
  );
  const unmet = (t.requires || []).filter((rid) => !completedIds.has(rid));
  return unmet.length > 0
    ? { status: "locked", unmet }
    : { status: t.status, unmet: [] };
}

function TaskCard({
  t,
  allTasks,
  cardBg,
  cardBorder,
  muted,
  fg,
  index = 0,
  onOpen,
}) {
  const { status, unmet } = getEffectiveStatus(t, allTasks);
  const urgent = status === "todo" && t.daysLeft > 0 && t.daysLeft <= 7;
  const icon = t.tag === "探索" ? "✦" : t.tag === "社区" ? "◉" : "❋";


  const statusChip =
    status === "completed"
      ? {
        label: "已完成",
        color: "#2E9B65",
        bg: "rgba(60,180,120,0.12)",
      }
      : status === "in_progress"
        ? {
          label: "進行中",
          color: "#C17F1E",
          bg: "rgba(220,150,40,0.14)",
        }
        : status === "expired"
          ? {
            label: "已過期",
            color: "#C0564E",
            bg: "rgba(200,80,70,0.12)",
          }
          : status === "locked"
            ? {
              label: "未解鎖",
              color: muted,
              bg: "rgba(120,110,150,0.1)",
            }
            : null;

  const logoBg =
    status === "completed"
      ? "linear-gradient(135deg, #7FCFA3, #5BAE85)"
      : status === "expired"
        ? "rgba(120,110,150,0.2)"
        : `linear-gradient(135deg, ${t.color}, ${t.color}BB)`;

  const logoGlyph =
    status === "completed"
      ? "✓"
      : status === "expired"
        ? "✕"
        : status === "locked"
          ? "🔒"
          : icon;
  const logoColor =
    status === "expired" ? ("#8a82a8") : "#fff";

  return (
    <div
      onClick={() => onOpen && onOpen(t.id)}
      style={{
        position: "relative",
        padding: "14px 14px",
        borderRadius: 18,
        background: cardBg,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: cardBorder,
        animation: `fadeInUp 0.5s ${0.15 + index * 0.06}s ease backwards`,
        cursor: "pointer",
        overflow: "hidden",
        boxShadow: "0 4px 14px rgba(254,210,52,0.18)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: 1,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          flexShrink: 0,
          background: logoBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: logoColor,
          fontSize: status === "locked" ? 18 : 20,
          fontWeight: 700,
          boxShadow: `0 4px 12px ${t.color}55`,
        }}
      >
        {logoGlyph}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: fg,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: "0 1 auto",
              minWidth: 0,
            }}
          >
            {t.title}
          </div>
          {statusChip && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: 9.5,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                color: statusChip.color,
                background: statusChip.bg,
                letterSpacing: 0.3,
                flexShrink: 0,
              }}
            >
              {statusChip.label}
            </div>
          )}
        </div>

        {status === "locked" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 11, color: muted }}>
              {t.due ? `截止 ${t.due}` : "無截止日"}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10,
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: 999,
                color: muted,
                background: "rgba(120,110,150,0.08)",
              }}
            >
              <span style={{ fontSize: 8 }}>🔒</span>
              需完成 {unmet.length} 項前置
            </div>
          </div>
        ) : status === "completed" ? (
          <div style={{ fontSize: 11, color: muted }}>
            {t.due ? `✓ 已於 ${t.due} 前完成` : "✓ 已完成"}
          </div>
        ) : status === "expired" ? (
          <div style={{ fontSize: 11, color: muted }}>於 {t.due} 過期</div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 11, color: muted }}>
              {t.due ? `截止 ${t.due}` : "無截止日"}
            </div>
            {t.due && typeof t.daysLeft === "number" && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 999,
                  color: urgent ? ("#D9534F") : muted,
                  background: urgent
                    ? "rgba(217,83,79,0.1)"
                    : "transparent",
                }}
              >
                <span style={{ fontSize: 8 }}>⏱</span>
                {urgent ? `剩 ${t.daysLeft} 天` : `${t.daysLeft} 天`}
              </div>
            )}
          </div>
        )}

        {status === "in_progress" && typeof t.progress === "number" && (
          <div
            style={{
              height: 4,
              borderRadius: 999,
              background: "rgba(254,210,52,0.22)",
              overflow: "hidden",
              marginTop: 2,
            }}
          >
            <div
              style={{
                width: `${Math.round(t.progress * 100)}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${t.color}, ${t.color}DD)`,
                borderRadius: 999,
              }}
            />
          </div>
        )}
      </div>

      <div
        style={{
          width: 1,
          alignSelf: "stretch",
          borderLeft: "1px dashed rgba(254,210,52,0.35)",
        }}
      />

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 4,
          minWidth: 92,
          maxWidth: 140,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color:
              status === "completed"
                ? "#2E9B65"
                : "#987701",
            whiteSpace: "nowrap",
            letterSpacing: 0.2,
            display: "inline-flex",
            alignItems: "baseline",
            gap: 2,
          }}
        >
          <span>
            {status === "completed" ? "✓ +" : "+"}
            {t.points}
          </span>
          <span style={{ fontSize: 12 }}>★</span>
        </div>
        {t.bonus && (
          <div
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #F4EBFF, #FFE892)",
              border: "1px solid rgba(184,164,227,0.45)",
              fontSize: 10,
              fontWeight: 700,
              color: "#7A5FC4",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              maxWidth: "100%",
              minWidth: 0,
              boxShadow: "0 2px 5px rgba(184,164,227,0.2)",
            }}
          >
            <span style={{ fontSize: 9, flexShrink: 0 }}>🎁</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: 0.2,
              }}
            >
              {t.bonus}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── News Board (home) ────────────────────────────────────────
function NewsBoard({ fg, muted, cardBg, cardBorder }) {
  const items = [
    {
      id: "n1",
      tag: "公告",
      tagColor: "#D06BA0",
      tagBg:
        "linear-gradient(135deg, rgba(248,178,198,0.3), rgba(218,123,153,0.2))",
      title: "夏季盛會志工招募開跑",
      body: "5 月 10 日金富有夏季盛會，需要接待、導覽、物資、秩序四大崗位志工。報名截止 4 月 30 日。",
      date: "4月18日",
      pinned: true,
    },
    {
      id: "n2",
      tag: "活動",
      tagColor: "#4EA886",
      tagBg:
        "linear-gradient(135deg, rgba(138,212,176,0.3), rgba(78,168,134,0.2))",
      title: "本月星點雙倍週即將開始",
      body: "4 月 22 – 28 日，所有任務星點 ×2。趕緊邀請夥伴一起組隊衝榜！",
      date: "4月16日",
    },
    {
      id: "n3",
      tag: "通知",
      tagColor: "#987701",
      tagBg:
        "linear-gradient(135deg, rgba(254,221,103,0.32), rgba(254,210,52,0.2))",
      title: "新任務「長者陪伴」已上線",
      body: "每週六下午安排 2 小時，陪伴社區長者聊天、散步，可獲得 120 星點。",
      date: "4月14日",
    },
  ];

  const [idx, setIdx] = useState(0);
  const trackRef = React.useRef(null);

  // Track scroll snap to keep dots in sync
  const onScroll = (e) => {
    const el = e.currentTarget;
    const w = el.clientWidth;
    const next = Math.round(el.scrollLeft / w);
    if (next !== idx) setIdx(next);
  };

  return (
    <div
      style={{
        flexShrink: 0,
        marginTop: 4,
        animation: "fadeInUp 0.5s 0.08s ease backwards",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: fg }}>新消息</div>
          <div
            style={{
              padding: "1px 7px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FFE29A, #FFC070)",
              color: "#6B4000",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {items.length}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {items.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === idx ? 16 : 6,
                height: 6,
                borderRadius: 999,
                background:
                  i === idx
                    ? "linear-gradient(90deg, #fed234, #fec701)"
                    : "rgba(152,119,1,0.22)",
                transition: "width 0.25s ease",
              }}
            />
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          margin: "0 -16px",
          padding: "0 16px 4px",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {items.map((n, i) => (
          <div
            key={n.id}
            className="news-track"
            style={{
              flexShrink: 0,
              width: "calc(100% - 32px)",
              scrollSnapAlign: "start",
              padding: "14px 16px",
              borderRadius: 18,
              background: cardBg,
              border: cardBorder,
              backdropFilter: "blur(8px)",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
            }}
          >
            {/* ambient glow */}
            <div
              style={{
                position: "absolute",
                top: -24,
                right: -24,
                width: 110,
                height: 110,
                borderRadius: 999,
                filter: "blur(24px)",
                background: n.tagBg,
                opacity: 0.65,
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      padding: "2px 9px",
                      borderRadius: 999,
                      background: n.tagBg,
                      color: n.tagColor,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0.3,
                    }}
                  >
                    {n.tag}
                  </div>
                  {n.pinned && (
                    <div
                      style={{
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: "rgba(254,199,1,0.18)",
                        color: "#987701",
                        fontSize: 10,
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      📌 置頂
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: muted, fontWeight: 600 }}>
                  {n.date}
                </div>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: fg,
                  lineHeight: 1.35,
                  marginBottom: 4,
                  letterSpacing: -0.2,
                }}
              >
                {n.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: muted,
                  lineHeight: 1.55,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {n.body}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#987701",
                }}
              >
                閱讀全文 →
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────
function HomeScreen({
  user,
  tasks: tasksProp,
  onSignOut,
  onNavigate,
  onOpenTask,
}) {
  const bg = "#FFFDF5";

  const tasks = tasksProp || TASKS;
  const activeTasks = tasks.filter((t) => {
    const { status } = getEffectiveStatus(t, tasks);
    return status === "todo" || status === "in_progress" || status === "locked";
  });

  const cardBg = "rgba(255,255,255,0.7)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";
  const muted = "rgba(50,40,0,0.6)";
  const fg = "#241c00";

  // Star points + tier progress (mirrors MyRewards tier thresholds)
  const totalPoints = (tasks || [])
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.points, 0);
  const homeTiers = [
    { name: "新手志工", required: 100, color: "#8AD4B0", gradEnd: "#4EA886" },
    { name: "熱心志工", required: 500, color: "#fed234", gradEnd: "#fec701" },
    { name: "服務先鋒", required: 1000, color: "#FFC170", gradEnd: "#F39770" },
    { name: "金牌志工", required: 2000, color: "#B8A4E3", gradEnd: "#8D71C7" },
  ];
  const homeTierIdx = homeTiers.findIndex((t) => totalPoints < t.required);
  const homeCurrentTier =
    homeTierIdx === -1
      ? homeTiers[homeTiers.length - 1]
      : homeTierIdx === 0
        ? null
        : homeTiers[homeTierIdx - 1];
  const homeNextTier = homeTierIdx === -1 ? null : homeTiers[homeTierIdx];
  const homePrevReq =
    homeTierIdx === -1
      ? homeTiers[homeTiers.length - 1].required
      : homeTierIdx === 0
        ? 0
        : homeTiers[homeTierIdx - 1].required;
  const homeNextReq = homeNextTier ? homeNextTier.required : totalPoints;
  const homeProgressPct = homeNextTier
    ? Math.min(
      1,
      Math.max(
        0,
        (totalPoints - homePrevReq) / Math.max(1, homeNextReq - homePrevReq),
      ),
    )
    : 1;
  const homeWeekDelta = 76;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 20px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          animation: "fadeIn 0.5s ease",
        }}
      >
        {/* Greeting row — avatar only (name moved into reward card) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
            flexShrink: 0,
            animation: "fadeInDown 0.5s ease",
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 2 }}>
              欢迎回来
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: fg,
                letterSpacing: 0.3,
              }}
            >
              金富有 · 志工
            </div>
          </div>
          <div
            onClick={onSignOut}
            title="登出"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${user?.avatar || "#fec701"}, ${user?.avatar || "#fec701"}CC)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}
          >
            {(user?.name || "你")[0]}
          </div>
        </div>

        {/* Points card */}
        {/* Points card */}
        <div
          onClick={() => onNavigate && onNavigate("rewards")}
          style={{
            borderRadius: 22,
            background: "linear-gradient(135deg, #FFF9DC 0%, #FFE892 70%, #FFDB5E 100%)",
            border: "1px solid rgba(254,199,1,0.4)",
            padding: "18px 20px 16px",
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
            cursor: "pointer",
            boxShadow: "0 8px 22px rgba(200,160,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)",
            animation: "fadeInUp 0.5s 0.05s ease backwards",
          }}
        >
          {/* Radial glow — top-right */}
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />

          {/* Top row: [name + tier stacked] (left)  |  [label + number stacked] (right) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
              position: "relative",
            }}
          >
            {/* Left column: name (with sparkles) + tier below */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minWidth: 0,
                flex: 1,
              }}
            >
              {/* Name */}
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#3a2800",
                  fontFamily: '"Noto Serif SC", serif',
                  letterSpacing: 0.5,
                  lineHeight: 1,
                }}
              >
                {user?.name || "朋友"}
              </div>
              {/* Tier below name */}
              {(() => {
                const tierName = homeCurrentTier?.name || "志工寶寶";
                const tierColor = homeCurrentTier?.color || "#b8a4e3";
                const isBaby = !homeCurrentTier;
                const tierTextColor = isBaby
                  ? "#8c4a9a"
                  : tierColor;
                return (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 13,
                      fontWeight: 800,
                      color: tierTextColor,
                      letterSpacing: 0.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>
                      {isBaby ? "🍼" : "🏅"}
                    </span>
                    {tierName}
                  </div>
                );
              })()}
            </div>

            {/* Right: 星光星點 label + 50 ★ stacked */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #fed234, #fec701)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    color: "#fff",
                    boxShadow: "0 2px 6px rgba(254,199,1,0.45)",
                  }}
                >
                  ★
                </span>
                <div
                  style={{
                    fontSize: 11,
                    color: "#8c6d00",
                    letterSpacing: 1.2,
                    fontWeight: 700,
                  }}
                >
                  星光星點
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 900,
                    letterSpacing: -1.5,
                    background:
                      "linear-gradient(135deg, #cb9f01 0%, #fec701 45%, #cb9f01 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontFamily: '"Noto Serif SC", serif',
                    lineHeight: 1,
                    textShadow: "0 2px 4px rgba(200,160,0,0.15)",
                  }}
                >
                  {totalPoints.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: "#cb9f01",
                    lineHeight: 1,
                    letterSpacing: -0.5,
                    textShadow: "0 2px 4px rgba(200,160,0,0.15)",
                  }}
                >
                  ★
                </div>
              </div>
            </div>
          </div>

          {/* Tier progress — bar with circular checkpoints */}
          <div style={{ marginTop: 14, position: "relative" }}>
            {homeNextTier ? (
              (() => {
                const rangeStart = homePrevReq;
                const rangeEnd = homeNextReq;
                const rangeSpan = Math.max(1, rangeEnd - rangeStart);
                const ticks = [0.2, 0.4, 0.6, 0.8, 1.0].map((p) => ({
                  pct: p,
                  value: Math.round(rangeStart + rangeSpan * p),
                }));
                return (
                  <>
                    {/* Bar + circular checkpoints */}
                    <div style={{ position: "relative", padding: "5px 0" }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: "rgba(120,90,0,0.12)",
                          overflow: "hidden",
                          position: "relative",
                          boxShadow: "inset 0 1px 2px rgba(120,90,0,0.1)",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: `${homeProgressPct * 100}%`,
                            background: `linear-gradient(90deg, ${homeCurrentTier?.color || "#fed234"}, ${homeNextTier.color})`,
                            borderRadius: 999,
                            boxShadow: `0 0 8px ${homeNextTier.color}88`,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      {/* Circular checkpoints */}
                      {ticks.map((t, i) => {
                        const reached = totalPoints >= t.value;
                        return (
                          <div
                            key={i}
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: `${t.pct * 100}%`,
                              transform: "translate(-50%, -50%)",
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: reached
                                ? "linear-gradient(135deg, #ffe066, #fec701)"
                                : "#fff",
                              border: reached
                                ? "2px solid #fff"
                                : "2px solid rgba(203,159,1,0.35)",
                              boxShadow: reached
                                ? "0 2px 5px rgba(203,159,1,0.45)"
                                : "0 1px 2px rgba(0,0,0,0.08)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.3s ease",
                            }}
                          >
                            {reached && (
                              <svg
                                width="7"
                                height="7"
                                viewBox="0 0 10 10"
                                fill="none"
                              >
                                <path
                                  d="M2 5.5L4 7.5L8 3"
                                  stroke="#fff"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Tick labels */}
                    <div
                      style={{
                        position: "relative",
                        height: 14,
                        marginTop: 4,
                      }}
                    >
                      {ticks.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            left: `${t.pct * 100}%`,
                            transform: "translateX(-50%)",
                            fontSize: 9.5,
                            fontWeight: 700,
                            color:
                              totalPoints >= t.value
                                ? "#8c6d00"
                                : muted,
                            letterSpacing: 0.2,
                          }}
                        >
                          {t.value}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()
            ) : (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg, rgba(184,164,227,0.25), rgba(141,113,199,0.15))",
                  border: "1px solid rgba(184,164,227,0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6B4FA8",
                }}
              >
                👑 已達最高等級·金牌志工
              </div>
            )}
          </div>
        </div>

        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
            flexShrink: 0,
            animation: "fadeInUp 0.5s 0.1s ease backwards",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: fg }}>
            探索任务
          </div>
          <div
            onClick={() => onNavigate && onNavigate("tasks")}
            style={{ fontSize: 12, color: muted, cursor: "pointer" }}
          >
            查看全部 →
          </div>
        </div>

        {/* Tasks — active only on home */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flexShrink: 0,
          }}
        >
          {activeTasks.length === 0 ? (
            <div
              style={{
                padding: "20px 16px",
                borderRadius: 16,
                background: cardBg,
                border: cardBorder,
                textAlign: "center",
                color: muted,
                fontSize: 13,
              }}
            >
              暫無進行中任務
            </div>
          ) : (
            activeTasks.map((t, i) => (
              <TaskCard
                key={t.id}
                t={t}
                allTasks={tasks}
                cardBg={cardBg}
                cardBorder={cardBorder}
                muted={muted}
                fg={fg}
                index={i}
                onOpen={onOpenTask}
              />
            ))
          )}
        </div>

        {/* Bottom nav */}
      </div>

      {/* Bottom nav */}
      <BottomNav
        current="home"
        muted={muted}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// ─── Bottom Nav (shared) ──────────────────────────────────────
function BottomNav({ current, muted, onNavigate }) {
  const items = [
    { key: "home", label: "首页", icon: "◉" },
    { key: "tasks", label: "任务", icon: "❋" },
    { key: "rank", label: "排行", icon: "▲" },
    { key: "me", label: "我的", icon: "●" },
  ];

  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        justifyContent: "space-around",
        padding: "10px 16px 18px",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(254,210,52,0.25)",
      }}
    >
      {items.map((n) => {
        const active = n.key === current;
        return (
          <div
            key={n.key}
            onClick={() => onNavigate && onNavigate(n.key)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              color: active ? ("#fec701") : muted,
            }}
          >
            <div style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</div>
            <div style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>
              {n.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tasks Screen ─────────────────────────────────────────────
function TasksScreen({
  tasks: tasksProp,
  onNavigate,
  onOpenTask,
}) {
  const bg = "#FFFDF5";
  const cardBg = "rgba(255,255,255,0.7)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";
  const muted = "rgba(50,40,0,0.6)";
  const fg = "#241c00";

  const [filter, setFilter] = useState("active");
  const tasks = tasksProp || TASKS;

  const counts = useMemo(() => {
    const c = {
      all: tasks.length,
      active: 0,
      completed: 0,
      expired: 0,
      locked: 0,
    };
    tasks.forEach((t) => {
      const { status } = getEffectiveStatus(t, tasks);
      if (status === "todo" || status === "in_progress" || status === "locked")
        c.active++;
      if (status === "completed") c.completed++;
      else if (status === "expired") c.expired++;
      else if (status === "locked") c.locked++;
    });
    return c;
  }, [tasks]);

  const filtered = tasks.filter((t) => {
    const { status } = getEffectiveStatus(t, tasks);
    if (filter === "all") return true;
    if (filter === "active")
      return (
        status === "todo" || status === "in_progress" || status === "locked"
      );
    return status === filter;
  });

  const tabs = [
    { key: "active", label: "待完成", n: counts.active },
    { key: "all", label: "全部", n: counts.all },
    { key: "completed", label: "已完成", n: counts.completed },
    { key: "expired", label: "已過期", n: counts.expired },
    { key: "locked", label: "未解鎖", n: counts.locked },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animation: "fadeIn 0.4s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: fg,
                letterSpacing: -0.3,
              }}
            >
              任務
            </div>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
              {counts.active} 個進行中 · {counts.completed} 個已完成
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            flexShrink: 0,
            margin: "0 -20px",
            padding: "2px 20px 6px",
            scrollbarWidth: "none",
          }}
        >
          {tabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  flexShrink: 0,
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: active
                    ? "none"
                    : "1px solid rgba(254,210,52,0.35)",
                  background: active
                    ? "linear-gradient(135deg, #fec701, #cb9f01)"
                    : cardBg,
                  color: active ? ("#fff") : fg,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {tab.label}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: active
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(120,110,150,0.12)",
                    color: active ? ("#fff") : muted,
                  }}
                >
                  {tab.n}
                </span>
              </button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                borderRadius: 16,
                background: cardBg,
                border: cardBorder,
                textAlign: "center",
                color: muted,
                fontSize: 13,
              }}
            >
              此類別暫無任務
            </div>
          ) : filter === "all" ? (
            (() => {
              const bucketOf = (t) => {
                const { status } = getEffectiveStatus(t, tasks);
                if (status === "completed") return "completed";
                if (status === "expired") return "expired";
                return "active"; // todo | in_progress | locked
              };
              const sections = [
                { key: "active", title: "待完成" },
                { key: "completed", title: "已完成" },
                { key: "expired", title: "已過期" },
              ];

              let idx = 0;
              return sections.map((sec, secIdx) => {
                const inSec = filtered.filter((t) => bucketOf(t) === sec.key);
                if (inSec.length === 0) return null;
                return (
                  <div
                    key={sec.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      marginTop: secIdx === 0 ? 0 : 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 10,
                        padding: "0 2px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: fg,
                          letterSpacing: 0.2,
                        }}
                      >
                        {sec.title}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          borderBottom: "1px dashed rgba(254,210,52,0.3)",
                          marginLeft: 4,
                        }}
                      />
                      <div
                        style={{ fontSize: 10, color: muted, fontWeight: 600 }}
                      >
                        {inSec.length}
                      </div>
                    </div>
                    {inSec.map((t) => {
                      const i = idx++;
                      return (
                        <TaskCard
                          key={t.id}
                          t={t}
                          allTasks={tasks}
                          cardBg={cardBg}
                          cardBorder={cardBorder}
                          muted={muted}
                          fg={fg}
                          index={i}
                          onOpen={onOpenTask}
                        />
                      );
                    })}
                  </div>
                );
              });
            })()
          ) : (
            filtered.map((t, i) => (
              <TaskCard
                key={t.id}
                t={t}
                allTasks={tasks}
                cardBg={cardBg}
                cardBorder={cardBorder}
                muted={muted}
                fg={fg}
                index={i}
                onOpen={onOpenTask}
              />
            ))
          )}
        </div>
      </div>

      <BottomNav
        current="tasks"
        muted={muted}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// ─── Task Detail Screen ──────────────────────────────────────
function TaskDetailScreen({
  tasks: tasksProp,
  taskId,
  onBack,
  onOpenTask,
  onStartTask,
  onGoMe,
}) {
  const bg = "#FFFDF5";
  const cardBg = "rgba(255,255,255,0.7)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";
  const muted = "rgba(50,40,0,0.6)";
  const fg = "#241c00";

  const tasks = tasksProp || TASKS;
  const t = tasks.find((x) => x.id === taskId);
  if (!t) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: bg,
          color: "#241c00",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 20, color: fg }}>找不到任務</div>
      </div>
    );
  }

  const { status, unmet } = getEffectiveStatus(t, tasks);
  const icon = t.tag === "探索" ? "✦" : t.tag === "社区" ? "◉" : "❋";
  const urgent = status === "todo" && t.daysLeft > 0 && t.daysLeft <= 7;

  const statusChip =
    status === "completed"
      ? { label: "已完成", color: "#2E9B65", bg: "rgba(80,200,140,0.18)" }
      : status === "in_progress"
        ? { label: "進行中", color: "#C17F1E", bg: "rgba(220,150,40,0.18)" }
        : status === "expired"
          ? { label: "已過期", color: "#C0564E", bg: "rgba(200,80,70,0.15)" }
          : status === "locked"
            ? { label: "未解鎖", color: "#655001", bg: "rgba(100,80,1,0.15)" }
            : { label: "待開始", color: "#655001", bg: "rgba(254,199,1,0.18)" };

  // Is this the team task (task 3)?
  const isTeamTask = t.id === 3;
  const teamState = t.teamProgress || null;
  const teamHasTeam = teamState != null;

  // CTA config by state
  const cta =
    status === "completed"
      ? { label: "✓ 已完成", disabled: true, tone: "success" }
      : status === "expired"
        ? { label: "此任務已過期", disabled: true, tone: "muted" }
        : isTeamTask && !teamHasTeam && status !== "locked"
          ? { label: "前往組隊", disabled: false, tone: "primary" }
          : isTeamTask && teamHasTeam
            ? { label: "前往管理團隊", disabled: false, tone: "primary" }
            : status === "in_progress"
              ? { label: "繼續任務", disabled: false, tone: "primary" }
              : status === "locked"
                ? { label: `前往前置任務`, disabled: false, tone: "secondary" }
                : { label: "開始任務", disabled: false, tone: "primary" };

  const completedSteps = (t.steps || []).filter((s) => s.done).length;
  const totalSteps = (t.steps || []).length;
  const stepProgress = totalSteps > 0 ? completedSteps / totalSteps : 0;

  const onCta = () => {
    if (cta.disabled) return;
    if (status === "locked" && unmet.length > 0) {
      onOpenTask && onOpenTask(unmet[0]);
      return;
    }
    // Team task — route to 我的 page for team management
    if (isTeamTask) {
      onGoMe && onGoMe();
      return;
    }
    // Route to the correct form based on task id
    onStartTask && onStartTask(t.id);
  };

  const prereqTasks = (t.requires || [])
    .map((rid) => tasks.find((x) => x.id === rid))
    .filter(Boolean);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          animation: "fadeIn 0.3s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 16px 6px 12px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onBack}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 8,
              borderRadius: 10,
              color: fg,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            返回
          </button>
          <button
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 8,
              borderRadius: 10,
              color: muted,
              fontSize: 18,
            }}
            title="分享"
          >
            ⇪
          </button>
        </div>

        {/* Hero card */}
        <div
          style={{
            margin: "6px 16px 0",
            padding: "22px 20px 24px",
            borderRadius: 24,
            background: `linear-gradient(135deg, ${t.color}EE 0%, ${t.color}B0 100%)`,
            boxShadow: `0 10px 32px ${t.color}40`,
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Giant background glyph */}
          <div
            style={{
              position: "absolute",
              right: -20,
              bottom: -40,
              fontSize: 220,
              color: "rgba(255,255,255,0.13)",
              lineHeight: 1,
              fontWeight: 900,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {status === "locked" ? "🔒" : icon}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.25)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            <span>{icon}</span> {t.tag}
          </div>

          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: "#fff",
              marginTop: 12,
              lineHeight: 1.25,
              letterSpacing: -0.3,
              textShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            {t.title}
          </div>

          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.92)",
              marginTop: 6,
              lineHeight: 1.5,
              textWrap: "pretty",
              maxWidth: "85%",
            }}
          >
            {t.summary}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.25)",
                backdropFilter: "blur(8px)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {statusChip.label}
            </div>
            {t.due && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.15)",
                  backdropFilter: "blur(8px)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 10 }}>⏱</span>
                截止 {t.due}
                {urgent ? ` · 剩 ${t.daysLeft} 天` : ""}
              </div>
            )}
            {!t.due && status !== "completed" && status !== "expired" && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.15)",
                  backdropFilter: "blur(8px)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                無截止日
              </div>
            )}
          </div>
        </div>

        {/* Content sections */}
        <div
          style={{
            padding: "16px 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Rewards */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              background: cardBg,
              border: cardBorder,
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                flexShrink: 0,
                background: "linear-gradient(135deg, #FFE29A, #FFC070)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                boxShadow: "0 4px 14px rgba(255,180,80,0.35)",
              }}
            >
              🏆
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  color: muted,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                完成獎勵
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#987701",
                  marginTop: 2,
                  letterSpacing: -0.2,
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 4,
                }}
              >
                <span>+{t.points}</span>
                <span style={{ fontSize: 18 }}>★</span>
                <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}>
                  星點
                </span>
              </div>
            </div>
          </div>

          {/* Special bonus gift — prominent */}
          {t.bonus && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 18,
                background: "linear-gradient(135deg, #F4EBFF, #FFF5D6 70%, #FFE892)",
                border: "1px solid rgba(184,164,227,0.5)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexShrink: 0,
                boxShadow: "0 6px 18px rgba(184,164,227,0.22)",
              }}
            >
              {/* sparkle accents */}
              <svg
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  opacity: 0.5,
                  pointerEvents: "none",
                }}
                width="90"
                height="70"
                viewBox="0 0 90 70"
              >
                {[
                  [18, 14, 2],
                  [62, 10, 1.2],
                  [76, 28, 1.8],
                  [46, 50, 1.2],
                  [28, 42, 1.5],
                  [82, 52, 1],
                ].map(([x, y, r], i) => (
                  <g key={i} transform={`translate(${x},${y})`}>
                    <circle r={r} fill="#fec701" />
                    <circle r={r * 0.3} fill="#fff" />
                  </g>
                ))}
              </svg>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  flexShrink: 0,
                  background: "linear-gradient(135deg, #b8a4e3, #9478cf)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: "#fff",
                  boxShadow: "0 6px 18px rgba(148,120,207,0.45)",
                  position: "relative",
                }}
              >
                🎁
                <div
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #fed234, #fec701)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "#fff",
                    fontWeight: 800,
                    boxShadow: "0 2px 6px rgba(254,199,1,0.5)",
                  }}
                >
                  ✦
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    color: "#7A5FC4",
                    textTransform: "uppercase",
                  }}
                >
                  ✦ 限定贈品
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    marginTop: 3,
                    color: fg,
                    letterSpacing: -0.2,
                    fontFamily: '"Noto Serif SC", serif',
                  }}
                >
                  {t.bonus}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: muted,
                    marginTop: 3,
                    fontWeight: 600,
                  }}
                >
                  完成本任務即可領取
                </div>
              </div>
            </div>
          )}

          {/* Prerequisites (only if has requires) */}
          {prereqTasks.length > 0 && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 18,
                background: cardBg,
                border: cardBorder,
                backdropFilter: "blur(10px)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 14 }}>🔗</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>
                  前置任務
                </div>
                <div style={{ fontSize: 11, color: muted, marginLeft: "auto" }}>
                  {prereqTasks.filter((p) => p.status === "completed").length}/
                  {prereqTasks.length} 已完成
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prereqTasks.map((p) => {
                  const done = p.status === "completed";
                  return (
                    <div
                      key={p.id}
                      onClick={() => onOpenTask && onOpenTask(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.5)",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          flexShrink: 0,
                          background: done
                            ? "linear-gradient(135deg, #7FCFA3, #5BAE85)"
                            : "rgba(120,110,150,0.18)",
                          color: done ? "#fff" : muted,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {done ? "✓" : ""}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 13,
                          fontWeight: 600,
                          color: fg,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.title}
                      </div>
                      <div style={{ fontSize: 11, color: muted }}>
                        {done
                          ? "已完成"
                          : p.status === "in_progress"
                            ? "進行中"
                            : "待開始"}
                      </div>
                      <span style={{ color: muted, fontSize: 12 }}>›</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Team progress (task 3) */}
          {isTeamTask && status !== "expired" && status !== "locked" && (
            <div
              style={{
                padding: "16px 16px",
                borderRadius: 18,
                background: teamHasTeam
                  ? "linear-gradient(135deg, rgba(254,221,103,0.25), rgba(254,210,52,0.15))"
                  : cardBg,
                border: teamHasTeam
                  ? "1px solid rgba(254,199,1,0.4)"
                  : cardBorder,
                backdropFilter: "blur(10px)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #fed234, #fec701)",
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 700,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ⚑
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>
                    組隊進度
                  </div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>
                    {teamHasTeam ? "集滿至少 6 人即可完成任務" : "尚未建立團隊"}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color:
                      teamHasTeam && teamState.total >= teamState.cap
                        ? "#2E9B65"
                        : fg,
                  }}
                >
                  {teamHasTeam ? teamState.total : 0}
                  <span style={{ fontSize: 13, color: muted, fontWeight: 600 }}>
                    /{teamState?.cap || 6}
                  </span>
                </div>
              </div>

              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(254,210,52,0.22)",
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: `${teamHasTeam ? Math.round((teamState.total / teamState.cap) * 100) : 0}%`,
                    height: "100%",
                    background:
                      teamHasTeam && teamState.total >= teamState.cap
                        ? "linear-gradient(90deg, #7FCFA3, #5BAE85)"
                        : "linear-gradient(90deg, #fed234, #fec701, #fec701)",
                    transition: "width 0.5s ease",
                    boxShadow: teamHasTeam
                      ? `0 0 14px ${teamState.total >= teamState.cap ? "rgba(127,207,163,0.55)" : "rgba(254,199,1,0.5)"}`
                      : "none",
                  }}
                />
              </div>

              {/* Dots visualization */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  justifyContent: "center",
                  marginTop: 10,
                }}
              >
                {Array.from({ length: teamState?.cap || 6 }).map((_, i) => {
                  const filled = teamHasTeam && i < teamState.total;
                  const isLeader = i === 0;
                  return (
                    <div
                      key={i}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        background: filled
                          ? isLeader
                            ? "linear-gradient(135deg, #fed234, #fec701)"
                            : "linear-gradient(135deg, #fec701, #fec701)"
                          : "transparent",
                        border: filled
                          ? "none"
                          : "1.5px dashed rgba(254,210,52,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: filled ? "#fff" : muted,
                        boxShadow: filled
                          ? "0 3px 10px rgba(254,199,1,0.35)"
                          : "none",
                      }}
                    >
                      {isLeader ? "⚑" : filled ? "✓" : ""}
                    </div>
                  );
                })}
              </div>

              {teamHasTeam && teamState.total < teamState.cap && (
                <div
                  style={{
                    fontSize: 11,
                    color: muted,
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  還差{" "}
                  <strong style={{ color: fg }}>
                    {teamState.cap - teamState.total}
                  </strong>{" "}
                  位隊員即可達標·前往「我的」頁面繼續邀請
                </div>
              )}
              {teamHasTeam && teamState.total >= teamState.cap && (
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 12,
                    textAlign: "center",
                    color: "#2E9B65",
                    fontWeight: 700,
                  }}
                >
                  ✓ 已達標·可繼續邀請更多夥伴加入
                </div>
              )}
              {!teamHasTeam && (
                <div
                  style={{
                    fontSize: 11,
                    color: muted,
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  點擊下方按鈕前往組隊
                </div>
              )}
            </div>
          )}

          {/* Progress (non-team tasks) */}
          {!isTeamTask && totalSteps > 0 && status !== "expired" && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 18,
                background: cardBg,
                border: cardBorder,
                backdropFilter: "blur(10px)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>
                  步驟進度
                </div>
                <div style={{ fontSize: 12, color: muted, fontWeight: 600 }}>
                  {completedSteps}/{totalSteps}
                </div>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(254,210,52,0.22)",
                  overflow: "hidden",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: `${Math.round(stepProgress * 100)}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${t.color}, ${t.color}DD)`,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {t.steps.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      opacity: s.done ? 0.7 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        flexShrink: 0,
                        background: s.done ? t.color : "transparent",
                        border: s.done
                          ? "none"
                          : `1.5px solid ${"rgba(120,110,150,0.3)"}`,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {s.done ? "✓" : ""}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: fg,
                        textDecoration: s.done ? "line-through" : "none",
                        textDecorationColor: muted,
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              background: cardBg,
              border: cardBorder,
              backdropFilter: "blur(10px)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: fg,
                marginBottom: 6,
              }}
            >
              任務說明
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(40,30,70,0.8)",
                lineHeight: 1.65,
                textWrap: "pretty",
              }}
            >
              {t.description}
            </div>
            {t.estMinutes && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid rgba(254,210,52,0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: muted,
                }}
              >
                <span>⏲</span> 預估需時約 {t.estMinutes} 分鐘
              </div>
            )}
          </div>
        </div>

        {/* Sticky CTA */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            padding: "12px 16px 16px",
            background: "linear-gradient(180deg, transparent, rgba(255,250,255,0.9) 40%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onCta}
            disabled={cta.disabled}
            style={{
              width: "100%",
              height: 54,
              borderRadius: 16,
              border: "none",
              cursor: cta.disabled ? "default" : "pointer",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 0.5,
              fontFamily: "inherit",
              background: cta.disabled
                ? "rgba(100,80,1,0.15)"
                : cta.tone === "secondary"
                  ? "rgba(255,255,255,0.7)"
                  : `linear-gradient(135deg, ${t.color}, ${t.color}D0)`,
              color: cta.disabled
                ? muted
                : cta.tone === "secondary"
                  ? fg
                  : "#fff",
              border:
                cta.tone === "secondary" ? `1.5px solid ${t.color}` : "none",
              boxShadow: cta.disabled ? "none" : `0 8px 24px ${t.color}50`,
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseDown={(e) =>
              !cta.disabled && (e.currentTarget.style.transform = "scale(0.98)")
            }
            onMouseUp={(e) =>
              !cta.disabled && (e.currentTarget.style.transform = "scale(1)")
            }
            onMouseLeave={(e) =>
              !cta.disabled && (e.currentTarget.style.transform = "scale(1)")
            }
          >
            {cta.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 排行 (Rank) Screen ────────────────────────────────────────
function RankScreen({ user, tasks, onNavigate }) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.7)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

  const [tab, setTab] = useState("personal"); // personal | team | challenge
  const [period, setPeriod] = useState("month"); // week | month | all

  const myPoints = (tasks || [])
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.points, 0);
  const myName = user?.nickname || user?.zhName || user?.name || "你";

  // Challenge tasks available for leaderboard
  const challenges = (tasks || []).filter((t) => t.isChallenge);
  const [selectedChallengeId, setSelectedChallengeId] = useState(
    challenges[0]?.id || null,
  );
  const selectedChallenge =
    challenges.find((c) => c.id === selectedChallengeId) || challenges[0];

  // Mock challenge completion data keyed by task id
  const challengeData = {
    3: {
      totalTeams: 42,
      activeTeams: 58,
      totalUsers: 248,
      completionRate: 0.72,
      teams: [
        {
          id: "ct1",
          name: "光明小隊",
          members: 8,
          leader: "張雅婷",
          completedAt: "04/12",
          days: 2,
          grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
        },
        {
          id: "ct2",
          name: "星辰行者",
          members: 6,
          leader: "陳俊宏",
          completedAt: "04/14",
          days: 4,
          grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
        },
        {
          id: "ct3",
          name: "晨光隊",
          members: 7,
          leader: "林佳怡",
          completedAt: "04/15",
          days: 5,
          grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
          isMe: true,
        },
        {
          id: "ct4",
          name: "和風社",
          members: 5,
          leader: "鄭宜庭",
          completedAt: "04/17",
          days: 7,
          grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
        },
        {
          id: "ct5",
          name: "光語隊",
          members: 6,
          leader: "許文斌",
          completedAt: "04/18",
          days: 8,
          grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
        },
        {
          id: "ct6",
          name: "星雨小組",
          members: 4,
          leader: "蔡依倫",
          completedAt: "04/19",
          days: 9,
          grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
        },
        {
          id: "ct7",
          name: "暖陽隊",
          members: 6,
          leader: "李雅雯",
          completedAt: "04/20",
          days: 10,
          grad: "linear-gradient(135deg, #fee99a, #fed234)",
        },
        {
          id: "ct8",
          name: "晨星社",
          members: 5,
          leader: "周明蓁",
          completedAt: "04/21",
          days: 11,
          grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
        },
      ],
    },
  };

  // Mock leaderboard data — per tab × period
  const personal = {
    week: [
      {
        id: "u1",
        name: "張雅婷",
        nick: "Claire",
        points: 420,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "u2",
        name: "陳俊宏",
        nick: "Kevin",
        points: 380,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "u3",
        name: "林佳怡",
        nick: "Jiayi",
        points: 310,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "u4",
        name: "黃詩涵",
        nick: "Shiya",
        points: 260,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
      },
      {
        id: "u5",
        name: "吳宗翰",
        nick: "Zonghan",
        points: 230,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "me",
        name: myName,
        nick: user?.enName || "",
        points: myPoints,
        team: "—",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
        isMe: true,
      },
      {
        id: "u6",
        name: "王美玲",
        nick: "Meiling",
        points: 170,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
      {
        id: "u7",
        name: "劉志豪",
        nick: "Zhihao",
        points: 140,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "u8",
        name: "蔡依倫",
        nick: "Yilun",
        points: 110,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #fee99a, #fed234)",
      },
    ],

    month: [
      {
        id: "u1",
        name: "陳俊宏",
        nick: "Kevin",
        points: 1820,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "u2",
        name: "張雅婷",
        nick: "Claire",
        points: 1640,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "u3",
        name: "黃詩涵",
        nick: "Shiya",
        points: 1380,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
      },
      {
        id: "u4",
        name: "林佳怡",
        nick: "Jiayi",
        points: 1210,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "u5",
        name: "吳宗翰",
        nick: "Zonghan",
        points: 980,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "u6",
        name: "王美玲",
        nick: "Meiling",
        points: 820,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
      {
        id: "u7",
        name: "劉志豪",
        nick: "Zhihao",
        points: 740,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "me",
        name: myName,
        nick: user?.enName || "",
        points: myPoints,
        team: "—",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
        isMe: true,
      },
      {
        id: "u8",
        name: "蔡依倫",
        nick: "Yilun",
        points: 420,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #fee99a, #fed234)",
      },
    ],

    all: [
      {
        id: "u1",
        name: "張雅婷",
        nick: "Claire",
        points: 8240,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "u2",
        name: "陳俊宏",
        nick: "Kevin",
        points: 7980,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "u3",
        name: "黃詩涵",
        nick: "Shiya",
        points: 6510,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
      },
      {
        id: "u4",
        name: "吳宗翰",
        nick: "Zonghan",
        points: 5870,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "u5",
        name: "林佳怡",
        nick: "Jiayi",
        points: 5340,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "u6",
        name: "王美玲",
        nick: "Meiling",
        points: 4220,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
      {
        id: "u7",
        name: "劉志豪",
        nick: "Zhihao",
        points: 3780,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "u8",
        name: "蔡依倫",
        nick: "Yilun",
        points: 2960,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #fee99a, #fed234)",
      },
      {
        id: "me",
        name: myName,
        nick: user?.enName || "",
        points: myPoints,
        team: "—",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
        isMe: true,
      },
    ],
  };

  const teams = {
    week: [
      {
        id: "t1",
        name: "光明小隊",
        members: 8,
        points: 1420,
        leader: "張雅婷",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "t2",
        name: "星辰行者",
        members: 6,
        points: 1180,
        leader: "陳俊宏",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "t3",
        name: "晨光隊",
        members: 7,
        points: 960,
        leader: "林佳怡",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "t4",
        name: "和風社",
        members: 5,
        points: 720,
        leader: "鄭宜庭",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "t5",
        name: "光語隊",
        members: 6,
        points: 580,
        leader: "許文斌",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
    ],

    month: [
      {
        id: "t1",
        name: "光明小隊",
        members: 8,
        points: 5840,
        leader: "張雅婷",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "t2",
        name: "星辰行者",
        members: 6,
        points: 4620,
        leader: "陳俊宏",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "t3",
        name: "晨光隊",
        members: 7,
        points: 3980,
        leader: "林佳怡",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "t4",
        name: "和風社",
        members: 5,
        points: 2840,
        leader: "鄭宜庭",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "t5",
        name: "光語隊",
        members: 6,
        points: 2160,
        leader: "許文斌",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "t6",
        name: "星雨小組",
        members: 4,
        points: 1420,
        leader: "蔡依倫",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
    ],

    all: [
      {
        id: "t1",
        name: "光明小隊",
        members: 8,
        points: 24620,
        leader: "張雅婷",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "t2",
        name: "星辰行者",
        members: 6,
        points: 21840,
        leader: "陳俊宏",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "t3",
        name: "晨光隊",
        members: 7,
        points: 18790,
        leader: "林佳怡",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "t4",
        name: "和風社",
        members: 5,
        points: 12640,
        leader: "鄭宜庭",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "t5",
        name: "光語隊",
        members: 6,
        points: 10260,
        leader: "許文斌",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "t6",
        name: "星雨小組",
        members: 4,
        points: 7480,
        leader: "蔡依倫",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
    ],
  };

  const isChallenge = tab === "challenge";
  const currentChallengeData =
    isChallenge && selectedChallenge
      ? challengeData[selectedChallenge.id]
      : null;

  const raw = isChallenge
    ? currentChallengeData?.teams || []
    : tab === "personal"
      ? personal[period]
      : teams[period];
  // Sort: challenge = by days (ascending, fastest first); others = by points desc
  const sorted = isChallenge
    ? [...raw].sort((a, b) => a.days - b.days)
    : [...raw].sort((a, b) => b.points - a.points);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const myRank =
    tab === "personal" ? sorted.findIndex((r) => r.isMe) + 1 : null;

  const PERIODS = [
    { key: "week", label: "本週" },
    { key: "month", label: "本月" },
    { key: "all", label: "總榜" },
  ];

  // Podium positions: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights =
    top3.length === 3 ? [104, 132, 88] : [132, 104, 88].slice(0, top3.length);
  const medalColors = ["#C9C9D1", "#FEC701", "#C78A5B"]; // silver, gold, bronze
  const rankLabels = ["2", "1", "3"];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Decorative glow */}
        <div
          style={{
            position: "absolute",
            inset: "-10% -10% auto -10%",
            height: 260,
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(254,199,1,0.35), transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 20px 6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: fg,
                letterSpacing: -0.5,
              }}
            >
              排行榜
            </div>
            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
              {tab === "personal"
                ? "志工星點排名"
                : tab === "team"
                  ? "團隊星點排名"
                  : "挑戰任務排名"}
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px 5px 8px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FFE29A, #FFC070)",
              color: "#6B4000",
              fontSize: 11,
              fontWeight: 800,
              boxShadow: "0 3px 10px rgba(255,180,80,0.25)",
            }}
          >
            ★ {myPoints}
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            flexShrink: 0,
            padding: "8px 20px 0",
            display: "flex",
            gap: 8,
            position: "relative",
            zIndex: 2,
          }}
        >
          {[
            { k: "personal", l: "個人" },
            { k: "team", l: "團隊" },
            { k: "challenge", l: "挑戰" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 14,
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                border: "none",
                background:
                  tab === t.k
                    ? "linear-gradient(135deg, #fed234, #fec701)"
                    : "rgba(255,255,255,0.7)",
                color: tab === t.k ? "#241c00" : fg,
                boxShadow:
                  tab === t.k ? "0 4px 14px rgba(254,199,1,0.32)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        {/* Period chips (personal/team) OR challenge selector (challenge) */}
        {!isChallenge ? (
          <div
            style={{
              flexShrink: 0,
              padding: "10px 20px 4px",
              display: "flex",
              gap: 6,
              position: "relative",
              zIndex: 2,
            }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border:
                    period === p.key
                      ? "1px solid rgba(254,199,1,0.7)"
                      : "1px solid rgba(0,0,0,0.08)",
                  background:
                    period === p.key
                      ? "rgba(254,199,1,0.22)"
                      : "transparent",
                  color:
                    period === p.key ? ("#987701") : muted,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <div
            style={{
              flexShrink: 0,
              padding: "10px 20px 4px",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              position: "relative",
              zIndex: 2,
            }}
          >
            {challenges.length === 0 ? (
              <div style={{ fontSize: 12, color: muted, padding: "5px 0" }}>
                暫無挑戰任務
              </div>
            ) : (
              challenges.map((c) => {
                const active = c.id === selectedChallengeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChallengeId(c.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      border: active
                        ? "1px solid rgba(254,199,1,0.7)"
                        : "1px solid rgba(0,0,0,0.08)",
                      background: active
                        ? "rgba(254,199,1,0.22)"
                        : "transparent",
                      color: active ? ("#987701") : muted,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 11 }}>⚑</span>
                    {c.title}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            minHeight: 0,
            padding: "14px 16px 96px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Challenge stats card */}
          {isChallenge && currentChallengeData && (
            <div
              style={{
                marginBottom: 14,
                padding: "14px 16px",
                borderRadius: 18,
                background: "linear-gradient(135deg, #FFF9DC, #FFE892)",
                border: "1px solid rgba(254,199,1,0.35)",
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 4px 12px rgba(254,199,1,0.14)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  flexShrink: 0,
                  background: "linear-gradient(135deg, #fed234, #fec701)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  color: "#fff",
                  boxShadow: "0 4px 10px rgba(254,199,1,0.4)",
                }}
              >
                ⚑
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: fg,
                    fontFamily: '"Noto Serif SC", serif',
                    letterSpacing: 0.3,
                    marginBottom: 4,
                  }}
                >
                  {selectedChallenge?.title}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 11,
                    color: muted,
                    fontWeight: 600,
                  }}
                >
                  <div>
                    <b
                      style={{
                        color: "#987701",
                        fontSize: 13,
                      }}
                    >
                      {currentChallengeData.totalTeams}
                    </b>{" "}
                    個團隊完成
                  </div>
                  <div>
                    <b
                      style={{
                        color: "#987701",
                        fontSize: 13,
                      }}
                    >
                      {currentChallengeData.totalUsers}
                    </b>{" "}
                    位志工參與
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 4,
                    borderRadius: 999,
                    background: "rgba(120,90,0,0.1)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${currentChallengeData.completionRate * 100}%`,
                      background: "linear-gradient(90deg, #fed234, #fec701)",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: muted, marginTop: 3 }}>
                  完成率 {Math.round(currentChallengeData.completionRate * 100)}
                  % ({currentChallengeData.totalTeams}/
                  {currentChallengeData.activeTeams} 報名團隊)
                </div>
              </div>
            </div>
          )}

          {/* Podium */}
          {top3.length === 3 && (
            <div
              style={{
                marginBottom: 18,
                padding: "22px 8px 14px",
                borderRadius: 22,
                position: "relative",
                background:
                  "linear-gradient(180deg, rgba(254,210,52,0.22), rgba(254,233,154,0.05) 70%, transparent)",
                border: "1px solid rgba(254,199,1,0.28)",
                overflow: "hidden",
              }}
            >
              {/* starfield hint */}
              <svg
                width="100%"
                height="100%"
                style={{ position: "absolute", inset: 0, opacity: 0.3 }}
              >
                {Array.from({ length: 14 }).map((_, i) => {
                  const x = (i * 37) % 100,
                    y = (i * 19) % 50,
                    r = ((i % 3) + 1) * 0.8;
                  return (
                    <circle
                      key={i}
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r={r}
                      fill="#fec701"
                    />
                  );
                })}
              </svg>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 14,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {podiumOrder.map((p, i) => {
                  const isWinner = i === 1;
                  const medal = medalColors[i];
                  const rankLbl = rankLabels[i];
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flex: 1,
                        maxWidth: 112,
                        minWidth: 0,
                        animation: `fadeInUp 0.5s ease ${i * 0.12}s both`,
                      }}
                    >
                      {/* Crown for #1 */}
                      {isWinner && (
                        <svg
                          width="32"
                          height="20"
                          viewBox="0 0 32 20"
                          style={{ marginBottom: -4 }}
                        >
                          <path
                            d="M2 18 L4 6 L10 12 L16 2 L22 12 L28 6 L30 18 Z"
                            fill="#fec701"
                            stroke="#987701"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                          <circle cx="4" cy="6" r="1.8" fill="#fff4cc" />
                          <circle cx="16" cy="2" r="1.8" fill="#fff4cc" />
                          <circle cx="28" cy="6" r="1.8" fill="#fff4cc" />
                        </svg>
                      )}
                      {/* Avatar */}
                      <div
                        style={{
                          width: isWinner ? 72 : 58,
                          height: isWinner ? 72 : 58,
                          borderRadius: 999,
                          background: p.grad,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: isWinner ? 24 : 20,
                          fontWeight: 800,
                          boxShadow: `0 8px 22px ${isWinner ? "rgba(254,199,1,0.5)" : "rgba(0,0,0,0.15)"}`,
                          border: `3px solid ${medal}`,
                          position: "relative",
                        }}
                      >
                        {tab === "team" || isChallenge ? (
                          <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          >
                            <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                            <circle cx="10" cy="7" r="3.5" />
                            <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M17 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        ) : (
                          p.name[0]
                        )}
                        {/* Rank badge */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: -6,
                            right: -6,
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: medal,
                            color: "#241c00",
                            fontSize: 11,
                            fontWeight: 900,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px solid #fff9e6",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                          }}
                        >
                          {rankLbl}
                        </div>
                      </div>
                      {/* Name */}
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: isWinner ? 14 : 12,
                          fontWeight: 800,
                          color: fg,
                          textAlign: "center",
                          lineHeight: 1.2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: muted,
                          marginTop: 2,
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        {tab === "team"
                          ? `${p.members} 人 · ${p.leader}`
                          : isChallenge
                            ? `${p.members} 人 · ${p.completedAt} 完成`
                            : p.team}
                      </div>
                      {/* Points pill / Days pill */}
                      <div
                        style={{
                          marginTop: 6,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: isWinner
                            ? "linear-gradient(135deg, #FFE29A, #FFC070)"
                            : "rgba(254,199,1,0.18)",
                          color: isWinner
                            ? "#6B4000"
                            : "#987701",
                          fontSize: 11,
                          fontWeight: 800,
                          boxShadow: isWinner
                            ? "0 3px 10px rgba(255,180,80,0.3)"
                            : "none",
                        }}
                      >
                        {isChallenge
                          ? `⏱ ${p.days} 天`
                          : `★ ${p.points.toLocaleString()}`}
                      </div>
                      {/* Plinth */}
                      <div
                        style={{
                          marginTop: 10,
                          width: "100%",
                          height: heights[i],
                          borderRadius: "14px 14px 4px 4px",
                          background: isWinner
                            ? "linear-gradient(180deg, #fed234, #fec701)"
                            : "rgba(255,255,255,0.85)",
                          border: isWinner
                            ? "none"
                            : "1px solid rgba(254,199,1,0.28)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isWinner
                            ? "#241c00"
                            : "#987701",
                          fontSize: 28,
                          fontWeight: 900,
                          fontFamily: '"Noto Serif SC", serif',
                          boxShadow: isWinner
                            ? "inset 0 -10px 20px rgba(152,119,1,0.3), 0 6px 18px rgba(254,199,1,0.35)"
                            : "inset 0 -6px 14px rgba(0,0,0,0.04)",
                          position: "relative",
                        }}
                      >
                        {rankLbl}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ranks 4+ list */}
          <div
            style={{
              borderRadius: 18,
              background: cardBg,
              border: cardBorder,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px 8px",
                fontSize: 12,
                fontWeight: 700,
                color: muted,
                letterSpacing: 0.5,
                borderBottom: "1px solid rgba(254,199,1,0.12)",
              }}
            >
              {tab === "personal"
                ? "其他志工"
                : tab === "team"
                  ? "其他團隊"
                  : "其他完成團隊"}
            </div>
            {rest.length === 0 ? (
              <div
                style={{
                  padding: "20px 16px",
                  fontSize: 12,
                  color: muted,
                  textAlign: "center",
                }}
              >
                暫無其他排名
              </div>
            ) : (
              rest.map((r, i) => {
                const actualRank = i + 4;
                const isMe = r.isMe;
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      borderTop:
                        i === 0
                          ? "none"
                          : "1px solid rgba(254,199,1,0.12)",
                      background: isMe
                        ? "rgba(254,199,1,0.18)"
                        : "transparent",
                      position: "relative",
                    }}
                  >
                    {isMe && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: 3,
                          borderRadius: "0 4px 4px 0",
                          background:
                            "linear-gradient(180deg, #fed234, #fec701)",
                        }}
                      />
                    )}
                    {/* Rank number */}
                    <div
                      style={{
                        width: 26,
                        textAlign: "center",
                        fontSize: 14,
                        fontWeight: 800,
                        color: isMe ? ("#987701") : muted,
                        fontFamily: '"Noto Serif SC", serif',
                      }}
                    >
                      {actualRank}
                    </div>
                    {/* Avatar */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        background: r.grad,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 800,
                        boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                      }}
                    >
                      {tab === "team" || isChallenge ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                          <circle cx="10" cy="7" r="3.5" />
                          <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M17 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      ) : (
                        r.name[0]
                      )}
                    </div>
                    {/* Name + subtitle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: fg,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.name}
                        {isMe && (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: "1px 6px",
                              borderRadius: 6,
                              fontSize: 9,
                              fontWeight: 800,
                              background:
                                "linear-gradient(135deg, #fed234, #fec701)",
                              color: "#241c00",
                              verticalAlign: "middle",
                            }}
                          >
                            你
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: muted,
                          marginTop: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tab === "team"
                          ? `${r.members} 人 · 隊長 ${r.leader}`
                          : isChallenge
                            ? `${r.members} 人 · ${r.completedAt} 完成`
                            : r.team}
                      </div>
                    </div>
                    {/* Points */}
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: isMe ? ("#987701") : fg,
                        fontFamily: '"Noto Serif SC", serif',
                        letterSpacing: -0.3,
                      }}
                    >
                      {isChallenge
                        ? `⏱ ${r.days} 天`
                        : `★ ${r.points.toLocaleString()}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Floating "我的排名" pill for personal tab */}
        {tab === "personal" && myRank > 0 && (
          <div
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 74,
              padding: "10px 14px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(254,199,1,0.45)",
              boxShadow:
                "0 10px 28px rgba(100,80,1,0.18), 0 0 0 1px rgba(254,210,52,0.18)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              zIndex: 3,
              animation: "fadeInUp 0.4s ease both",
            }}
          >
            <div
              style={{
                width: 36,
                textAlign: "center",
                fontSize: 11,
                fontWeight: 700,
                color: muted,
              }}
            >
              我的
              <br />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#987701",
                  fontFamily: '"Noto Serif SC", serif',
                }}
              >
                #{myRank}
              </span>
            </div>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "linear-gradient(135deg, #fed234, #fec701)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 14,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {myName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>
                {myName}
              </div>
              <div style={{ fontSize: 10, color: muted }}>
                {myRank <= 3
                  ? "太厲害了！你在前三名 🎉"
                  : myRank <= 10
                    ? "加油，即將進入前十！"
                    : "繼續完成任務累積星點"}
              </div>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "#987701",
                fontFamily: '"Noto Serif SC", serif',
              }}
            >
              ★ {myPoints.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <BottomNav
        current="rank"
        muted={muted}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// ─── My Rewards (MyScreen) ────────────────────────────────────
function MyRewards({ fg,
  muted,
  cardBg,
  cardBorder,
  totalPoints,
  hideHeader,
}) {
  // Milestone tiers — unlocked determined by totalPoints
  const tiers = [
    {
      id: "t1",
      name: "新手志工",
      required: 100,
      icon: "leaf",
      color: "#8AD4B0",
      gradEnd: "#4EA886",
      desc: "完成首次任務",
    },
    {
      id: "t2",
      name: "熱心志工",
      required: 500,
      icon: "star",
      color: "#fed234",
      gradEnd: "#fec701",
      desc: "累積 500 星點",
    },
    {
      id: "t3",
      name: "服務先鋒",
      required: 1000,
      icon: "medal",
      color: "#FFC170",
      gradEnd: "#F39770",
      desc: "累積 1000 星點",
    },
    {
      id: "t4",
      name: "金牌志工",
      required: 2000,
      icon: "crown",
      color: "#B8A4E3",
      gradEnd: "#8D71C7",
      desc: "累積 2000 星點",
    },
  ];

  // Determine current + next tier
  const unlockedCount = tiers.filter((t) => totalPoints >= t.required).length;
  const nextTier =
    tiers.find((t) => totalPoints < t.required) || tiers[tiers.length - 1];
  const prevRequired =
    tiers.find((t, i) => t === nextTier) && tiers.indexOf(nextTier) > 0
      ? tiers[tiers.indexOf(nextTier) - 1].required
      : 0;
  const progressPct = Math.min(
    1,
    Math.max(
      0,
      (totalPoints - prevRequired) /
      Math.max(1, nextTier.required - prevRequired),
    ),
  );
  const reachedMax = totalPoints >= tiers[tiers.length - 1].required;

  const renderIcon = (icon, size = 28) => {
    const s = size;
    if (icon === "leaf")
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 3c-5 0-10 2-13 5-2 2-3 5-3 8 0 3 1 4 2 4 5-1 9-3 12-6s4-7 2-11z" />
          <path
            d="M4 20c2-4 5-7 9-9"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );

    if (icon === "star")
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
        </svg>
      );

    if (icon === "medal")
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="14" r="7" />
          <path
            d="M7 3l3 7M17 3l-3 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="14" r="3" fill="rgba(255,255,255,0.45)" />
        </svg>
      );

    if (icon === "crown")
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18l2-10 4 4 3-6 3 6 4-4 2 10z" />
          <rect x="3" y="18" width="18" height="3" rx="1" />
        </svg>
      );

    return null;
  };

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Header */}
      {!hideHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 4px 10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #fed234, #fec701)",
                fontWeight: 800,
                letterSpacing: 0.3,
                fontSize: 13,
                color: "#fff",
              }}
            >
              🎁 我的獎勵
            </div>
          </div>
          <div style={{ fontSize: 11, color: muted, fontWeight: 600 }}>
            已解鎖 {unlockedCount} / {tiers.length}
          </div>
        </div>
      )}

      {/* Progress hero */}
      <div
        style={{
          padding: "16px 16px",
          borderRadius: 20,
          background:
            "linear-gradient(135deg, rgba(254,221,103,0.3), rgba(254,210,52,0.16), rgba(254,233,154,0.2))",
          border: "1px solid rgba(254,199,1,0.4)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* sparkle dots */}
        <svg
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.22,
            pointerEvents: "none",
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => {
            const x = (i * 41) % 100,
              y = (i * 17) % 80,
              r = ((i % 3) + 1) * 0.9;
            return (
              <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="#fec701" />
            );
          })}
        </svg>
        <div style={{ position: "relative", zIndex: 1 }}>
          {reachedMax ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 6px 16px rgba(141,113,199,0.4)",
                }}
              >
                {renderIcon("crown", 24)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: fg }}>
                  金牌志工達成 🎉
                </div>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                  你已解鎖所有階段獎勵
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0.6,
                      color: "#987701",
                      textTransform: "uppercase",
                    }}
                  >
                    下一階段
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: fg,
                      marginTop: 2,
                      letterSpacing: -0.2,
                    }}
                  >
                    {nextTier.name}
                  </div>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: `linear-gradient(135deg, ${nextTier.color}, ${nextTier.gradEnd})`,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: `0 6px 16px ${nextTier.color}55`,
                  }}
                >
                  {renderIcon(nextTier.icon, 22)}
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.6)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(4, progressPct * 100)}%`,
                    background: `linear-gradient(90deg, ${nextTier.color}, ${nextTier.gradEnd})`,
                    borderRadius: 999,
                    boxShadow: `0 0 12px ${nextTier.color}80`,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: 11,
                  color: muted,
                  fontWeight: 600,
                }}
              >
                <span>
                  還差{" "}
                  <span style={{ color: fg, fontWeight: 800 }}>
                    {(nextTier.required - totalPoints).toLocaleString()}
                  </span>{" "}
                  星點
                </span>
                <span>
                  {totalPoints} / {nextTier.required}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Badges (tiers) horizontal scroll */}
      <div
        style={{
          marginTop: 14,
          padding: "4px 4px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: fg }}>階段徽章</div>
        <div style={{ fontSize: 11, color: muted, fontWeight: 600 }}>
          已解鎖 {unlockedCount} / {tiers.length}
        </div>
      </div>
      <div
        style={{
          margin: "8px -16px 0",
          padding: "0 16px",
          display: "flex",
          gap: 10,
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {tiers.map((t) => {
          const unlocked = totalPoints >= t.required;
          const current = !unlocked && t === nextTier;
          return (
            <div
              key={t.id}
              className="rw-hscroll"
              style={{
                flexShrink: 0,
                width: 118,
                padding: "12px 10px 10px",
                borderRadius: 16,
                background: unlocked
                  ? `linear-gradient(160deg, ${t.color}28, ${t.gradEnd}14)`
                  : current
                    ? "linear-gradient(160deg, rgba(254,210,52,0.18), rgba(254,233,154,0.08))"
                    : cardBg,
                border: unlocked
                  ? `1px solid ${t.color}70`
                  : current
                    ? "1px dashed rgba(254,199,1,0.55)"
                    : cardBorder,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                opacity: !unlocked && !current ? 0.6 : 1,
                backdropFilter: "blur(8px)",
              }}
            >
              {/* Badge */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: unlocked
                    ? `linear-gradient(135deg, ${t.color}, ${t.gradEnd})`
                    : "rgba(255,255,255,0.6)",
                  color: unlocked ? "#fff" : muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: unlocked ? `0 6px 16px ${t.color}55` : "none",
                  border: unlocked
                    ? "none"
                    : "1px dashed rgba(152,119,1,0.3)",
                  position: "relative",
                  marginBottom: 8,
                }}
              >
                {renderIcon(t.icon, unlocked ? 26 : 22)}
                {!unlocked && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.98)",
                      border: "1px solid rgba(152,119,1,0.35)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: muted,
                    }}
                  >
                    🔒
                  </div>
                )}
                {unlocked && (
                  <div
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: "linear-gradient(135deg, #7FCFA3, #5BAE85)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid #fff9e6",
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: fg,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: muted,
                  marginTop: 3,
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                {t.desc}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: 800,
                  color: unlocked ? ("#987701") : muted,
                }}
              >
                ★ {t.required.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Points history */}
      <div
        style={{
          marginTop: 14,
          padding: "4px 4px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: fg }}>星點紀錄</div>
        <div
          style={{
            fontSize: 11,
            color: muted,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          查看全部 →
        </div>
      </div>
      {(() => {
        const history = [
          {
            id: "h1",
            title: "完成任務 · 填寫金富有志工表單",
            source: "任務獎勵",
            points: 50,
            color: "#fec701",
            gradEnd: "#fed234",
            date: "今天 14:32",
            icon: "✓",
          },
          {
            id: "h2",
            title: "每日簽到",
            source: "每日獎勵",
            points: 10,
            color: "#8AD4B0",
            gradEnd: "#4EA886",
            date: "今天 09:15",
            icon: "◉",
          },
          {
            id: "h3",
            title: "夏季盛會報名 · 階段完成",
            source: "任務進度",
            points: 40,
            color: "#F8B2C6",
            gradEnd: "#DA7B99",
            date: "昨天 20:48",
            icon: "❋",
          },
          {
            id: "h4",
            title: "組隊達標獎勵",
            source: "團隊獎勵",
            points: 80,
            color: "#B8A4E3",
            gradEnd: "#8D71C7",
            date: "4月17日",
            icon: "⚑",
          },
          {
            id: "h5",
            title: "邀請好友加入",
            source: "推薦獎勵",
            points: 30,
            color: "#FFC170",
            gradEnd: "#F39770",
            date: "4月15日",
            icon: "♡",
          },
          {
            id: "h6",
            title: "完成任務 · 春季志工培訓",
            source: "任務獎勵",
            points: 30,
            color: "#fec701",
            gradEnd: "#fed234",
            date: "4月10日",
            icon: "✓",
            expired: true,
          },
          {
            id: "h7",
            title: "個人資料完整度達 100%",
            source: "成就獎勵",
            points: 20,
            color: "#A5C8F7",
            gradEnd: "#6A94CE",
            date: "4月8日",
            icon: "★",
          },
        ];

        // Grouped by day label for visual rhythm
        const grouped = [];
        let lastDate = null;
        history.forEach((h) => {
          const key = h.date.split(" ")[0];
          if (key !== lastDate) {
            grouped.push({ header: key });
            lastDate = key;
          }
          grouped.push({ entry: h });
        });

        return (
          <div
            style={{
              marginTop: 8,
              borderRadius: 16,
              background: cardBg,
              border: cardBorder,
              backdropFilter: "blur(8px)",
              overflow: "hidden",
            }}
          >
            {grouped.map((g, i) => {
              if (g.header) {
                return (
                  <div
                    key={"h-" + i}
                    style={{
                      padding: i === 0 ? "10px 14px 6px" : "10px 14px 6px",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0.8,
                      color: muted,
                      textTransform: "uppercase",
                      borderTop:
                        i === 0
                          ? "none"
                          : "1px solid rgba(254,199,1,0.14)",
                      background: "rgba(254,210,52,0.06)",
                    }}
                  >
                    {g.header}
                  </div>
                );
              }
              const h = g.entry;
              return (
                <div
                  key={h.id}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderTop: "1px solid rgba(254,199,1,0.1)",
                  }}
                >
                  {/* Icon chip */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: `linear-gradient(135deg, ${h.color}, ${h.gradEnd})`,
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 4px 10px ${h.color}40`,
                    }}
                  >
                    {h.icon}
                  </div>
                  {/* Title + source */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: fg,
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {h.title}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: muted,
                        marginTop: 2,
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>{h.source}</span>
                      <span>·</span>
                      <span>
                        {h.date.split(" ").slice(1).join(" ") || h.date}
                      </span>
                    </div>
                  </div>
                  {/* Points */}
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      lineHeight: 1,
                      color: "#987701",
                      fontFamily: '"Noto Serif SC", serif',
                      whiteSpace: "nowrap",
                    }}
                  >
                    +{h.points}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        marginLeft: 2,
                        opacity: 0.8,
                      }}
                    >
                      ★
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Rewards Screen (full page) ───────────────────────────────
function RewardsScreen({ user, tasks, onBack }) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "#FFFBE6";
  const cardBorder = "1px solid rgba(254,199,1,0.22)";

  const totalPoints = (tasks || [])
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.points, 0);
  const displayName = user?.nickname || user?.zhName || user?.name || "志工";
  const initial = (displayName || "U").slice(0, 1).toUpperCase();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 8px 6px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          position: "relative",
          zIndex: 2,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: fg,
            fontSize: 20,
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: fg, flex: 1 }}>
          我的獎勵
        </div>
        <div style={{ width: 40 }} />
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          minHeight: 0,
          padding: "4px 16px 20px",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {/* Hero summary card */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "20px 20px 22px",
            borderRadius: 22,
            background: "linear-gradient(160deg, #FFE48C 0%, #FFEEAD 55%, #FFF7D6 100%)",
            border: "1px solid rgba(254,199,1,0.3)",
            boxShadow: "0 8px 22px rgba(200,160,0,0.12)",
            marginBottom: 14,
          }}
        >
          {/* sparkle field */}
          <svg
            width="100%"
            height="100%"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.28,
              pointerEvents: "none",
            }}
          >
            {Array.from({ length: 16 }).map((_, i) => {
              const x = (i * 41) % 100,
                y = (i * 19) % 90,
                r = ((i % 3) + 1) * 0.9;
              return (
                <circle
                  key={i}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r={r}
                  fill="#fec701"
                />
              );
            })}
          </svg>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: "linear-gradient(135deg, #fed234, #fec701)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 800,
                color: "#fff",
                boxShadow: "0 8px 22px rgba(254,199,1,0.4)",
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: muted,
                  letterSpacing: 0.5,
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    letterSpacing: -1,
                    fontFamily: '"Noto Serif SC", serif',
                    background: "linear-gradient(135deg, #987701, #cb9f01)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    lineHeight: 1,
                  }}
                >
                  ★ {totalPoints.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reuse MyRewards body (tiers + history) — no outer heading */}
        <MyRewards
          fg={fg}
          muted={muted}
          cardBg={cardBg}
          cardBorder={cardBorder}
          totalPoints={totalPoints}
          hideHeader
        />
      </div>
    </div>
  );
}

// ─── My (我的) Screen ─────────────────────────────────────────
function MyScreen({
  user,
  ledTeam,
  joinedTeam,
  tasks,
  onSignOut,
  onNavigate,
  onBuildTeam,
  onApproveRequest,
  onRejectRequest,
  onRenameTeam,
  onCancelJoinRequest,
  onLeaveLedTeam,
  onLeaveJoinedTeam,
  onSimulateJoinApproved,
  onOpenTask,
}) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.7)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

  const totalPoints = (tasks || [])
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.points, 0);

  const teamTask = (tasks || []).find((t) => t.id === 3);
  const teamCap = (teamTask && teamTask.cap) || 6;
  const ledTotal = ledTeam ? ledTeam.members.length + 1 : 0;
  const joinedTotal = joinedTeam
    ? (joinedTeam.currentCount || 0) +
    (joinedTeam.status === "approved" ? 1 : 0)
    : 0;
  const hasAnyTeam = ledTeam || joinedTeam;
  const [teamTab, setTeamTab] = useState(
    ledTeam && !joinedTeam ? "leader" : "member",
  );
  const [userIdCopied, setUserIdCopied] = useState(false);
  const copyUserId = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user?.id) return;
    try {
      navigator.clipboard && navigator.clipboard.writeText(user.id);
    } catch (err) { }
    setUserIdCopied(true);
    setTimeout(() => setUserIdCopied(false), 1800);
  };

  const completedCount = (tasks || []).filter(
    (t) => t.status === "completed",
  ).length;
  const teamCount =
    (ledTeam ? 1 : 0) +
    (joinedTeam && joinedTeam.status === "approved" ? 1 : 0);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          animation: "fadeIn 0.3s ease",
          padding: "10px 16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Top bar: title + settings */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 2px 0",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: fg,
              letterSpacing: -0.3,
            }}
          >
            我的
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onSignOut}
              title="登出"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: "rgba(255,255,255,0.7)",
                color: "#a14646",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
            <button
              onClick={() => onNavigate("profile")}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: "rgba(255,255,255,0.7)",
                color: "#7a5a00",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hero profile card with integrated stats */}
        <div
          style={{
            borderRadius: 28,
            overflow: "hidden",
            flexShrink: 0,
            position: "relative",
            background: "linear-gradient(155deg, #FFE48C 0%, #FFE9B8 45%, #F4EBFF 100%)",
            border: "1px solid rgba(254,199,1,0.28)",
            boxShadow: "0 10px 30px rgba(200,160,0,0.14), 0 2px 6px rgba(184,164,227,0.12), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        >
          {/* Decorative starfield + mountain silhouette */}
          <svg
            width="100%"
            height="100%"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.55,
            }}
            viewBox="0 0 400 280"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="my-mtn" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={"#d9c8f5"}
                  stopOpacity="0.3"
                />
                <stop
                  offset="100%"
                  stopColor={"#d9c8f5"}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {/* distant mountains */}
            <path
              d="M0,240 L60,195 L120,225 L180,180 L240,210 L300,170 L360,205 L400,190 L400,280 L0,280 Z"
              fill="url(#my-mtn)"
            />
            {/* scattered stars */}
            {[
              [40, 32, 1.4],
              [82, 58, 0.9],
              [140, 24, 1.1],
              [208, 48, 1.6],
              [268, 30, 1.0],
              [332, 60, 1.3],
              [368, 22, 0.8],
              [56, 92, 0.9],
              [300, 95, 1.1],
              [180, 105, 0.7],
            ].map(([x, y, r], i) => (
              <g key={i} transform={`translate(${x},${y})`}>
                <circle
                  r={r + 0.4}
                  fill={"#fec701"}
                  opacity="0.7"
                />
                <circle r={r * 0.3} fill="#fff" />
              </g>
            ))}
            {/* crescent moon */}
            <g transform="translate(340,52)">
              <circle
                r="14"
                fill={"rgba(254,199,1,0.35)"}
              />
              <circle
                r="14"
                cx="5"
                cy="-2"
                fill={"#FFE48C"}
              />
            </g>
          </svg>

          {/* Identity */}
          <button
            type="button"
            onClick={() => onNavigate("profile")}
            style={{
              padding: "24px 20px 20px",
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 15,
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "background 0.15s",
            }}
            onMouseOver={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.25)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {/* Avatar with halo ring */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                style={{
                  position: "absolute",
                  inset: -5,
                  borderRadius: 999,
                  background:
                    "conic-gradient(from 180deg, #fed234, #b8a4e3, #fed234)",
                  opacity: 0.6,
                  filter: "blur(2px)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  width: 68,
                  height: 68,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #fed234, #fec701)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  boxShadow:
                    "0 8px 22px rgba(254,199,1,0.4), inset 0 2px 0 rgba(255,255,255,0.4)",
                  fontFamily: '"Noto Serif SC", serif',
                  border: "2px solid rgba(255,255,255,0.9)",
                }}
              >
                {user?.name ? user.name[0] : "志"}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: 21,
                    fontWeight: 800,
                    color: fg,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.name || "志工"}
                </div>
                {user?.id && (
                  <span
                    onClick={copyUserId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") copyUserId(e);
                    }}
                    title={userIdCopied ? "已複製" : "點擊複製 ID"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'ui-monospace, "SF Mono", monospace',
                      letterSpacing: 0.3,
                      background: userIdCopied
                        ? "rgba(80,180,120,0.18)"
                        : "rgba(255,255,255,0.55)",
                      color: userIdCopied
                        ? "#2d8050"
                        : "rgba(90,70,0,0.85)",
                      border: "1px solid rgba(120,90,0,0.12)",
                      cursor: "pointer",
                      transition: "all 0.18s ease",
                    }}
                  >
                    {user.id}
                    {userIdCopied ? (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: muted,
                  marginTop: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.email || "volunteer@example.com"}
              </div>
            </div>
            <div
              style={{
                fontSize: 22,
                color: muted,
                flexShrink: 0,
                lineHeight: 1,
                paddingLeft: 4,
              }}
            >
              ›
            </div>
          </button>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "rgba(120,90,0,0.1)",
            }}
          ></div>

          {/* Stats row — star points (tap to view rewards) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
            <button
              type="button"
              onClick={() => onNavigate("rewards")}
              style={{
                padding: "16px 18px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: fg,
                transition: "background 0.15s",
                textAlign: "left",
              }}
              onMouseOver={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.35)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(254,210,52,0.2)",
                  color: "#987701",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: fg,
                    lineHeight: 1.2,
                  }}
                >
                  星光獎勵
                </div>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: -0.3,
                  background: "linear-gradient(135deg, #fed234, #fec701)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontFamily: '"Noto Serif SC", serif',
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  flexShrink: 0,
                }}
              >
                ★ {totalPoints}
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: muted,
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                ›
              </div>
            </button>
          </div>
        </div>

        {/* Team cards stack — tabbed */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Tabs — underline-style, role-colored */}
          <div
            style={{
              display: "flex",
              gap: 0,
              position: "relative",
              borderBottom: "1px solid rgba(120,90,0,0.12)",
            }}
          >
            {[
              {
                id: "member",
                glyph: "✦",
                label: "我是組員",
                color: "#3d7a2e",
                accent: "#6dae4a",
                softBg: "rgba(168,214,128,0.14)",
              },
              {
                id: "leader",
                glyph: "⚑",
                label: "我是組長",
                color: "#8c6d00",
                accent: "#fec701",
                softBg: "rgba(254,210,52,0.14)",
              },
            ].map((t) => {
              const active = teamTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTeamTab(t.id)}
                  style={{
                    flex: 1,
                    padding: "12px 10px 11px",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: active ? t.softBg : "transparent",
                    color: active
                      ? t.color
                      : "rgba(120,90,0,0.45)",
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    position: "relative",
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                    transition: "all 0.22s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      transform: active ? "scale(1.15)" : "scale(1)",
                      transition: "transform 0.22s ease",
                      display: "inline-block",
                    }}
                  >
                    {t.glyph}
                  </span>
                  <span>{t.label}</span>
                  {/* Active indicator bar — overlaps container border */}
                  <span
                    style={{
                      position: "absolute",
                      left: 10,
                      right: 10,
                      bottom: -1,
                      height: 3,
                      borderRadius: "3px 3px 0 0",
                      background: active ? t.accent : "transparent",
                      boxShadow: active ? `0 0 8px ${t.accent}66` : "none",
                      transition: "all 0.22s ease",
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Panel */}
          {teamTab === "member" && (
            <div>
              {!joinedTeam ? (
                <div
                  style={{
                    padding: "14px 14px 14px 16px",
                    borderRadius: 16,
                    background: "rgba(168,214,128,0.12)",
                    border: "1px solid rgba(109,174,74,0.3)",
                    backdropFilter: "blur(10px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: "rgba(109,174,74,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      color: "#3d7a2e",
                      flexShrink: 0,
                    }}
                  >
                    ✦
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      color: "#3d7a2e",
                      lineHeight: 1.4,
                      fontSize: "15px",
                      fontWeight: 600,
                    }}
                  >
                    還沒加入任何團隊
                  </div>
                  <button
                    onClick={onBuildTeam}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      background: "linear-gradient(135deg, #6dae4a, #4e9a2e)",
                      color: "#fff",
                      fontWeight: 800,
                      fontFamily: "inherit",
                      boxShadow: "0 3px 10px rgba(109,174,74,0.4)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      fontSize: "15px",
                    }}
                  >
                    🔍 搜尋加入
                  </button>
                </div>
              ) : (
                <>
                  {joinedTeam.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginBottom: 8,
                      }}
                    >
                      <button
                        onClick={onSimulateJoinApproved}
                        title="Demo：模擬隊長核准申請"
                        style={{
                          padding: "3px 9px",
                          borderRadius: 999,
                          border: "1px dashed rgba(254,210,52,0.45)",
                          background: "transparent",
                          color: muted,
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ▶ 模擬核准
                      </button>
                    </div>
                  )}
                  <TeamCard
                    team={joinedTeam}
                    total={joinedTotal}
                    cap={teamCap}
                    variant="joined"
                    fg={fg}
                    muted={muted}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    onCancelRequest={onCancelJoinRequest}
                    onLeaveTeam={onLeaveJoinedTeam}
                    onOpenTeamTask={() => onOpenTask && onOpenTask(3)}
                  />
                </>
              )}
            </div>
          )}

          {teamTab === "leader" && (
            <div>
              {!ledTeam ? (
                <div
                  style={{
                    padding: "14px 14px 14px 16px",
                    borderRadius: 16,
                    background: cardBg,
                    border: cardBorder,
                    backdropFilter: "blur(10px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: "rgba(254,210,52,0.22)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      color: muted,
                      flexShrink: 0,
                    }}
                  >
                    ⚑
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12,
                      color: muted,
                      lineHeight: 1.4,
                    }}
                  >
                    尚未建立任何團隊
                  </div>
                  <button
                    onClick={() => onOpenTask && onOpenTask(3)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      background: "linear-gradient(135deg, #fec701, #fec701)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      fontFamily: "inherit",
                      boxShadow: "0 3px 10px rgba(254,210,52,0.4)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    ⚑ 建立團隊
                  </button>
                </div>
              ) : (
                <TeamCard
                  team={ledTeam}
                  total={ledTotal}
                  cap={teamCap}
                  variant="led"
                  fg={fg}
                  muted={muted}
                  cardBg={cardBg}
                  cardBorder={cardBorder}
                  onApproveRequest={onApproveRequest}
                  onRejectRequest={onRejectRequest}
                  onRenameTeam={onRenameTeam}
                  onLeaveTeam={onLeaveLedTeam}
                  onOpenTeamTask={() => onOpenTask && onOpenTask(3)}
                />
              )}
            </div>
          )}
        </div>

        {/* Account menu list removed — logout moved to top bar */}
      </div>

      <BottomNav
        current="me"
        muted={muted}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// Reusable iOS-style list row for the My page menu
function MenuRow({
  icon,
  label,
  trailing,
  onClick,
  fg,
  muted,
  destructive,
  divider,
}) {
  const color = destructive ? ("#D9534F") : fg;
  const iconBg = destructive
    ? "rgba(217,83,79,0.12)"
    : "rgba(254,210,52,0.2)";
  const iconColor = destructive
    ? "#D9534F"
    : "#987701";
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 16px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        color,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: divider
          ? "1px solid rgba(120,90,0,0.08)"
          : "none",
        transition: "background 0.15s",
      }}
      onMouseOver={(e) =>
      (e.currentTarget.style.background = "rgba(255,255,255,0.45)")
      }
      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: iconBg,
          color: iconColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div
        style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 700 }}
      >
        {label}
      </div>
      {trailing && <div style={{ marginRight: 6 }}>{trailing}</div>}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: muted, flexShrink: 0 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function TeamCard({
  team,
  total,
  cap,
  fg,
  muted,
  cardBg,
  cardBorder,
  variant,
  onApproveRequest,
  onRejectRequest,
  onCancelRequest,
  onLeaveTeam,
  onOpenTeamTask,
  onRenameTeam,
}) {
  const isMemberCard = variant === "joined";
  // Role-specific color palette threaded through the card
  const rc = isMemberCard
    ? {
      primary: "#4d8a37",
      primaryDeep: "#3d6b2e",
      bg: "#F3FBEA",
      bannerGrad: "linear-gradient(135deg, #CDEAB0, #A8D680 60%, #CDEAB0)",
      border: "1px solid rgba(110,170,80,0.3)",
      borderSoft: "1px solid rgba(110,170,80,0.2)",
      borderStrong: "1px solid rgba(80,140,60,0.4)",
      divider: "1px solid rgba(80,140,60,0.12)",
      shadow: "0 4px 16px rgba(80,140,60,0.1)",
      starIcon: "#6aa840",
      chipBg: "rgba(168,214,128,0.35)",
      chipBgSoft: "rgba(180,220,160,0.4)",
      leaderRowBg: "linear-gradient(135deg, rgba(168,214,128,0.4), rgba(200,232,168,0.25))",
      leaderRowBorder: "1px solid rgba(110,170,80,0.35)",
      shareGrad:
        "linear-gradient(135deg, #6dae4a 0%, #538a37 50%, #6dae4a 100%)",
      shareFallback: "rgba(168,214,128,0.22)",
    }
    : {
      primary: "#987701",
      primaryDeep: "#655001",
      bg: "#FFF4C4",
      bannerGrad: "linear-gradient(135deg, #FFE892, #FFDB5E 60%, #FFE892)",
      border: "1px solid rgba(254,199,1,0.28)",
      borderSoft: "1px solid rgba(254,210,52,0.18)",
      borderStrong: "1px solid rgba(254,199,1,0.4)",
      divider: "1px solid rgba(120,90,0,0.08)",
      shadow: "0 4px 16px rgba(200,160,0,0.08)",
      starIcon: "#fec701",
      chipBg: "rgba(254,210,52,0.25)",
      chipBgSoft: "rgba(254,210,52,0.12)",
      leaderRowBg: "linear-gradient(135deg, rgba(254,221,103,0.28), rgba(254,210,52,0.16))",
      leaderRowBorder: "1px solid rgba(254,199,1,0.4)",
      shareGrad:
        "linear-gradient(135deg, #e8a900 0%, #c48c00 50%, #e8a900 100%)",
      shareFallback: "rgba(254,210,52,0.12)",
    };
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const copyId = () => {
    try {
      navigator.clipboard && navigator.clipboard.writeText(team.id);
    } catch (e) { }
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 1800);
  };
  const shareUrl = "golden-abundance.vercel.app";
  const shareMessage = `嗨！我在「金富有」建立了志工團隊，一起來加入吧 ✨\n\n團隊編號：${team.id}\n開啟 App：${shareUrl}\n\n進入 App 後，點「我的 › 搜尋加入」輸入編號 ${team.id} 即可申請。`;
  const copyShare = () => {
    try {
      navigator.clipboard && navigator.clipboard.writeText(shareMessage);
    } catch (e) { }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1800);
  };
  // Pending member waiting for approval
  if (team.role === "member" && team.status === "pending") {
    return (
      <div
        style={{
          padding: "18px 18px",
          borderRadius: 20,
          background: "linear-gradient(135deg, #E4F3D0, #D4EAC0)",
          border: rc.borderStrong,
          boxShadow: rc.shadow,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "linear-gradient(135deg, #A8D680, #6dae4a)",
              color: "#fff",
              fontSize: 22,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            ⏳
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: fg,
                lineHeight: 1.2,
              }}
            >
              等待組長審核中
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "10px 10px 10px 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.75)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: rc.borderSoft,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: team.leader.avatar,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {team.leader.name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>
              {team.leader.name}
            </div>
            <button
              type="button"
              onClick={copyId}
              title={idCopied ? "已複製" : "點擊複製編號"}
              style={{
                padding: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                color: idCopied ? ("#2E9B65") : muted,
                marginTop: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "monospace",
              }}
            >
              {team.id}
              {idCopied ? (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.7 }}
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
          <button
            onClick={onCancelRequest}
            style={{
              padding: "7px 12px",
              borderRadius: 10,
              border: rc.borderStrong,
              cursor: "pointer",
              background: "transparent",
              color: muted,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            撤回申請
          </button>
        </div>
      </div>
    );
  }

  // Full team view (leader OR approved member)
  const pct = Math.min(1, total / cap);
  const complete = total >= cap;
  // Deterministic pseudo-points per member, based on name
  const memberPoints = (name) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return 400 + (Math.abs(h) % 1200); // 400–1600
  };
  const allMembers = [
    {
      id: team.leader.id,
      name: team.leader.name,
      avatar: team.leader.avatar,
      isLeader: true,
    },
    ...team.members.map((m) => ({ ...m, isLeader: false })),
  ];

  const requests = team.role === "leader" ? team.requests || [] : [];

  // Unified approved-team view (leader & member share same layout)
  const isLeader = team.role === "leader";
  const teamPoints = team.points != null ? team.points : total * 180 + 240;
  const teamRank = team.rank || 3;
  const weekPoints =
    team.weekPoints != null ? team.weekPoints : Math.round(teamPoints * 0.18);

  return (
    <>
      <div
        style={{
          borderRadius: 24,
          overflow: "hidden",
          background: rc.bg,
          border: rc.border,
          boxShadow: "0 8px 24px rgba(80,140,60,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Banner — unified layout for leader & member */}
        <div
          style={{
            padding: "18px 18px 16px",
            background: rc.bannerGrad,
            borderBottom: rc.divider,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative starfield motif */}
          <svg
            width="100%"
            height="100%"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.5,
            }}
            viewBox="0 0 400 120"
            preserveAspectRatio="xMaxYMid slice"
          >
            {[
              [328, 22, 1.4],
              [352, 42, 0.9],
              [376, 28, 1.1],
              [300, 58, 0.8],
              [345, 75, 1.2],
              [378, 92, 0.9],
            ].map(([x, y, r], i) => (
              <g key={i} transform={`translate(${x},${y})`}>
                <circle
                  r={r + 0.4}
                  fill={
                    isMemberCard ? ("#6dae4a") : "#fec701"
                  }
                  opacity="0.6"
                />
                <circle r={r * 0.3} fill="#fff" />
              </g>
            ))}
            {/* thin constellation line */}
            <path
              d={`M 300 58 L 345 75 L 378 92 L 352 42 L 328 22`}
              stroke={isMemberCard ? ("#6dae4a") : "#fec701"}
              strokeWidth="0.6"
              fill="none"
              opacity="0.35"
            />
          </svg>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Role label */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 9px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.6)",
                  border: rc.borderSoft,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  color: rc.primaryDeep,
                  textTransform: "uppercase",
                  marginBottom: 7,
                }}
              >
                {isLeader ? "⚑ 組長團隊" : "✦ 組員身份"}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: fg,
                  lineHeight: 1.15,
                  fontFamily: '"Noto Serif SC", serif',
                  letterSpacing: -0.3,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {team.name}
                </span>
                {isLeader && onRenameTeam && (
                  <button
                    onClick={() => setRenameOpen(true)}
                    title={team.alias ? "編輯組名" : "新增組名"}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: rc.borderStrong,
                      background: "rgba(255,255,255,0.85)",
                      color: rc.primary,
                      fontSize: 11,
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✎
                  </button>
                )}
                {!isLeader && onLeaveTeam && (
                  <button
                    onClick={() => setLeaveConfirmOpen(true)}
                    title="退出團隊"
                    style={{
                      padding: "4px 11px",
                      borderRadius: 999,
                      border: rc.borderStrong,
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.7)",
                      color: muted,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    退出
                  </button>
                )}
              </div>
              {isLeader && team.alias && (
                <div
                  style={{
                    fontSize: 12,
                    color: muted,
                    marginTop: 4,
                    fontWeight: 600,
                  }}
                >
                  {team.alias}
                </div>
              )}
              {!isLeader && (
                <div
                  style={{
                    color: muted,
                    marginTop: 4,
                    fontWeight: 600,
                    fontSize: "15px",
                  }}
                >
                  組長 · {team.leader.name}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={copyId}
              title={idCopied ? "已複製" : "點擊複製編號"}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                background: idCopied
                  ? "rgba(80,200,140,0.18)"
                  : "rgba(255,255,255,0.85)",
                border: idCopied
                  ? "1px solid rgba(80,200,140,0.45)"
                  : rc.borderStrong,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                flexShrink: 0,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.18s ease",
              }}
            >
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  color: muted,
                  textTransform: "uppercase",
                }}
              >
                團隊編號
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: idCopied ? ("#2E9B65") : fg,
                  marginTop: 3,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  letterSpacing: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {team.id}
                {idCopied ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.7 }}
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Prominent share invite — leader only */}
        {isLeader && (
          <button
            onClick={() => setShareOpen(true)}
            style={{
              padding: "16px 18px",
              border: "none",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              background:
                "linear-gradient(135deg, #fff3c8 0%, #ffe48a 40%, #fec701 100%)",
              color: "#5a4500",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderBottom: "1px solid rgba(120,90,0,0.1)",
              borderTop: "1px solid rgba(254,199,1,0.3)",
              textAlign: "left",
              width: "100%",
            }}
          >
            {/* decorative sparkle trail */}
            <svg
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                opacity: 0.5,
              }}
              width="100%"
              height="100%"
              viewBox="0 0 400 80"
              preserveAspectRatio="xMaxYMid slice"
            >
              {[
                [320, 18, 1.4],
                [355, 38, 1.0],
                [378, 22, 0.8],
                [298, 55, 1.1],
                [368, 62, 1.3],
              ].map(([x, y, r], i) => (
                <g key={i} transform={`translate(${x},${y})`}>
                  <circle r={r + 0.4} fill="#fff" opacity="0.7" />
                  <circle r={r * 0.3} fill="#fff" />
                </g>
              ))}
            </svg>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: "linear-gradient(135deg, #fff, #fff5d4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
                position: "relative",
                zIndex: 1,
                boxShadow:
                  "0 4px 12px rgba(200,160,0,0.25), inset 0 0 0 1.5px rgba(254,199,1,0.4)",
              }}
            >
              📨
            </div>
            <div
              style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  color: "#8c6d00",
                  textTransform: "uppercase",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 3,
                }}
              >
                <span style={{ fontSize: 9 }}>✦</span> 組長專屬任務
              </div>
              <div
                style={{
                  fontWeight: 800,
                  lineHeight: 1.15,
                  fontSize: 18,
                  color: "#5a4500",
                  fontFamily: '"Noto Serif SC", serif',
                  letterSpacing: -0.3,
                }}
              >
                邀請組員加入
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#8c6d00",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                每邀請 1 人
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #fec701, #e8a900)",
                    color: "#fff",
                    boxShadow: "0 2px 6px rgba(200,160,0,0.4)",
                    fontWeight: 800,
                    fontSize: 11,
                    letterSpacing: 0.3,
                  }}
                >
                  +20 ★
                </span>
              </div>
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #5a4500, #3d2f00)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                position: "relative",
                zIndex: 1,
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              分享
            </div>
          </button>
        )}

        {/* Stats row — points + rank */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.35fr 1fr",
            borderBottom: rc.divider,
            background: "rgba(255,255,255,0.55)",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              position: "relative",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: muted,
                letterSpacing: 1,
                fontSize: 10,
                textTransform: "uppercase",
              }}
            >
              團隊總星點
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                flexWrap: "wrap",
                marginTop: 2,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 28,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: fg,
                  fontFamily: '"Noto Serif SC", serif',
                  letterSpacing: -0.8,
                }}
              >
                <span style={{ color: rc.starIcon, fontSize: 22 }}>★</span>
                {teamPoints.toLocaleString()}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: rc.primary,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <span style={{ fontSize: 9 }}>▲</span>
              本週 +{weekPoints.toLocaleString()}
            </div>
          </div>
          <div
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              borderLeft: rc.divider,
              position: "relative",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: muted,
                letterSpacing: 1,
                fontSize: 10,
                textTransform: "uppercase",
              }}
            >
              本月排名
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 2,
                marginTop: 2,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: muted,
                  lineHeight: 1,
                }}
              >
                #
              </span>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: rc.primary,
                  fontFamily: '"Noto Serif SC", serif',
                  letterSpacing: -1.2,
                  background: `linear-gradient(135deg, ${rc.primary}, ${rc.primaryDeep})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {teamRank}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: muted,
                marginTop: 2,
              }}
            >
              {teamRank <= 3
                ? "🏆 進入前三"
                : teamRank <= 10
                  ? "進入前十"
                  : "持續努力中"}
            </div>
          </div>
        </div>

        {/* Members */}
        <div style={{ padding: "16px 18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: fg,
                letterSpacing: 0.5,
                fontSize: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 14,
                  borderRadius: 2,
                  background: rc.primary,
                  display: "inline-block",
                }}
              />
              組員
              <span
                style={{
                  color: muted,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                · {total} 人
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {allMembers
              .map((m) => ({ ...m, points: memberPoints(m.name) }))
              .sort((a, b) => b.points - a.points)
              .map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px 10px 10px",
                    borderRadius: 14,
                    background: m.isLeader
                      ? rc.leaderRowBg
                      : "rgba(255,255,255,0.7)",
                    border: m.isLeader ? rc.leaderRowBorder : rc.borderSoft,
                    boxShadow: m.isLeader
                      ? `0 2px 6px ${isMemberCard ? "rgba(109,174,74,0.12)" : "rgba(200,160,0,0.1)"}`
                      : "none",
                  }}
                >
                  {/* rank badge */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      background:
                        i === 0
                          ? "linear-gradient(135deg, #fed234, #fec701)"
                          : i === 1
                            ? "rgba(180,190,200,0.5)"
                            : i === 2
                              ? "rgba(210,170,130,0.55)"
                              : "transparent",
                      color:
                        i === 0
                          ? "#fff"
                          : i <= 2
                            ? "#fff"
                            : muted,
                      border:
                        i > 2
                          ? "1px solid rgba(120,90,0,0.2)"
                          : "none",
                      fontFamily: '"Noto Serif SC", serif',
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: m.avatar,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      border: "1.5px solid rgba(255,255,255,0.9)",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
                    }}
                  >
                    {m.name[0]}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: fg,
                        lineHeight: 1.2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.name}
                    </div>
                    {m.isLeader && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: rc.primary,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: rc.chipBg,
                          flexShrink: 0,
                          letterSpacing: 0.3,
                        }}
                      >
                        組長
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: rc.primary,
                      fontFamily: '"Noto Serif SC", serif',
                      letterSpacing: -0.3,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 11 }}>★</span>
                    {m.points.toLocaleString()}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Requests */}
        {isLeader && requests.length > 0 && !complete && (
          <div
            style={{
              padding: "12px 16px 14px",
              borderTop: "1px solid rgba(120,90,0,0.08)",
              background:
                "linear-gradient(180deg, rgba(255,214,168,0.1), transparent)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 800,
                color: "#C17F1E",
                letterSpacing: 0.4,
                marginBottom: 10,
                fontSize: "15px",
              }}
            >
              待審核申請 · {requests.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {requests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: "6px 8px 6px 6px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(255,255,255,0.9)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      background: req.avatar,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {req.name[0]}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      color: fg,
                    }}
                  >
                    {req.name}
                  </div>
                  <button
                    onClick={() => onApproveRequest && onApproveRequest(req.id)}
                    title="核准"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      background: "linear-gradient(135deg, #7FCFA3, #5BAE85)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => onRejectRequest && onRejectRequest(req.id)}
                    title="拒絕"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: "1px solid rgba(254,210,52,0.4)",
                      cursor: "pointer",
                      background: "transparent",
                      color: muted,
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLeader && requests.length === 0 && !complete && (
          <div
            style={{
              padding: "10px 16px 14px",
              borderTop: "1px solid rgba(120,90,0,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: muted,
                textAlign: "center",
                padding: "10px",
                borderRadius: 12,
                background: "rgba(254,210,52,0.1)",
                border: "1px dashed rgba(254,210,52,0.3)",
              }}
            >
              尚無加入申請 · 分享邀請讓夥伴找到你
            </div>
          </div>
        )}
      </div>

      {shareOpen && (
        <ShareSheet
          team={team}
          message={shareMessage}
          copied={shareCopied}
          onCopy={copyShare}
          onClose={() => setShareOpen(false)}
          fg={fg}
          muted={muted}
        />
      )}
      {renameOpen && onRenameTeam && (
        <RenameTeamSheet
          team={team}
          onClose={() => setRenameOpen(false)}
          onSave={(alias) => {
            onRenameTeam(alias);
            setRenameOpen(false);
          }}
          fg={fg}
          muted={muted}
        />
      )}
      {leaveConfirmOpen && (
        <div
          onClick={() => setLeaveConfirmOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 220,
            background: "rgba(20,10,40,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              background: "#fff",
              borderRadius: 20,
              padding: "22px 22px 18px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              animation: "scaleIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 999,
                margin: "0 auto 14px",
                background: "rgba(217,83,79,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
              }}
            >
              🚪
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: fg,
                textAlign: "center",
                marginBottom: 6,
                fontFamily: '"Noto Serif SC", serif',
              }}
            >
              確定要退出團隊？
            </div>
            <div
              style={{
                fontSize: 13,
                color: muted,
                textAlign: "center",
                marginBottom: 18,
                lineHeight: 1.5,
              }}
            >
              退出「{team.name}」後，組員身份將會解除。
              <br />
              若之後想重新加入，需再次送出申請。
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setLeaveConfirmOpen(false)}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(120,90,0,0.18)",
                  background: "transparent",
                  color: fg,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  setLeaveConfirmOpen(false);
                  onLeaveTeam && onLeaveTeam();
                }}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #d66060, #b03e3e)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(180,60,60,0.35)",
                }}
              >
                確定退出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Rename team — alias bottom sheet
function RenameTeamSheet({ team, onClose, onSave, fg, muted }) {
  const [value, setValue] = useState(team.alias || "");
  const sheetBg = "#FFFFFF";
  const inputBg = "rgba(254,210,52,0.15)";
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(20,10,40,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: sheetBg,
          borderRadius: "22px 22px 0 0",
          padding: "12px 18px 22px",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.25)",
          animation: "slideUp 0.28s ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: 8,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: "rgba(40,30,70,0.2)",
            }}
          />
        </div>
        <div
          style={{ fontSize: 16, fontWeight: 800, color: fg, marginBottom: 2 }}
        >
          設定團隊組名
        </div>
        <div
          style={{
            fontSize: 12,
            color: muted,
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          預設名稱「{team.name}」會一同顯示；組名會作為主要名稱呈現。
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 20))}
          placeholder="例如：星光小隊"
          autoFocus
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 12,
            background: inputBg,
            border: "1px solid rgba(254,210,52,0.35)",
            fontSize: 15,
            color: fg,
            fontFamily: "inherit",
            marginBottom: 14,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          {team.alias && (
            <button
              onClick={() => onSave("")}
              style={{
                padding: "11px 14px",
                borderRadius: 12,
                border: "1px solid rgba(254,210,52,0.4)",
                background: "transparent",
                color: muted,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              移除組名
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: team.alias ? "none" : 1,
              padding: "11px 14px",
              borderRadius: 12,
              border: "1px solid rgba(254,210,52,0.4)",
              background: "transparent",
              color: muted,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            disabled={!value.trim()}
            onClick={() => onSave(value.trim())}
            style={{
              flex: 1,
              padding: "11px 14px",
              borderRadius: 12,
              border: "none",
              background: value.trim()
                ? "linear-gradient(135deg, #fed234, #fec701)"
                : "rgba(254,210,52,0.25)",
              color: value.trim() ? "#fff" : muted,
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: value.trim() ? "pointer" : "not-allowed",
              boxShadow: value.trim()
                ? "0 4px 12px rgba(254,199,1,0.4)"
                : "none",
            }}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}

// Share sheet — bottom-sheet with messenger apps + editable message preview
function ShareSheet({
  team,
  message,
  copied,
  onCopy,
  onClose,
  fg,
  muted,
}) {
  const apps = [
    { key: "line", label: "LINE", bg: "#06C755", glyph: "L" },
    { key: "whatsapp", label: "WhatsApp", bg: "#25D366", glyph: "◉" },
    {
      key: "messenger",
      label: "Messenger",
      bg: "linear-gradient(135deg, #0078FF, #9745FF)",
      glyph: "✦",
    },
    {
      key: "ig",
      label: "Instagram",
      bg: "linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)",
      glyph: "◎",
    },
    { key: "wechat", label: "微信", bg: "#07C160", glyph: "✉" },
    { key: "sms", label: "訊息", bg: "#34D399", glyph: "💬" },
  ];

  const sheetBg = "#FFFFFF";
  const previewBg = "rgba(254,210,52,0.15)";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(20,10,40,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: sheetBg,
          borderRadius: "22px 22px 0 0",
          padding: "12px 18px 22px",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.25)",
          animation: "slideUp 0.28s ease-out",
        }}
      >
        {/* Grab handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: 8,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: "rgba(40,30,70,0.2)",
            }}
          />
        </div>

        <div
          style={{ fontSize: 16, fontWeight: 800, color: fg, marginBottom: 2 }}
        >
          分享團隊邀請
        </div>
        <div style={{ fontSize: 12, color: muted, marginBottom: 14 }}>
          編號 {team.id}·將下列訊息分享到聊天
        </div>

        {/* Message preview */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            background: previewBg,
            border: "1px solid rgba(254,210,52,0.25)",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: fg,
            whiteSpace: "pre-wrap",
            maxHeight: 160,
            overflowY: "auto",
            marginBottom: 16,
          }}
        >
          {message}
        </div>

        {/* Messenger apps */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {apps.map((a) => (
            <button
              key={a.key}
              onClick={onCopy}
              title={`分享到 ${a.label}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "4px 2px",
                borderRadius: 12,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: a.bg,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 800,
                  boxShadow: "0 3px 8px rgba(0,0,0,0.12)",
                }}
              >
                {a.glyph}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: fg,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {a.label}
              </div>
            </button>
          ))}
        </div>

        {/* Copy + close row */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCopy}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              background: copied
                ? "linear-gradient(135deg, #7FCFA3, #5BAE85)"
                : "linear-gradient(135deg, #fed234, #fec701)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "inherit",
              transition: "background 0.25s",
            }}
          >
            {copied ? "✓ 已複製到剪貼簿" : "📋 複製訊息"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid rgba(254,210,52,0.35)",
              background: "transparent",
              cursor: "pointer",
              color: muted,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            關閉
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Task Form Screens ───────────────────────────────────────
function FormShell({ bg,
  title,
  subtitle,
  onCancel,
  children,
  footer,
}) {
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px 6px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 8,
              borderRadius: 10,
              color: fg,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            取消
          </button>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: fg,
              textAlign: "center",
              flex: 1,
            }}
          >
            {title}
          </div>
          <div style={{ width: 72 }} />
        </div>

        {subtitle && (
          <div
            style={{
              padding: "0 20px 4px",
              fontSize: 12,
              color: muted,
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            minHeight: 0,
            padding: "16px 16px 20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {children}
          </div>
        </div>

        {/* Sticky footer */}
        {footer && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              padding: "12px 16px 16px",
              background: "linear-gradient(180deg, transparent, rgba(255,250,255,0.92) 40%)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldLabel({ children, required }) {
  const fg = "#241c00";
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: fg, marginBottom: 8 }}>
      {children}{" "}
      {required && <span style={{ color: "#E57B7B", fontWeight: 700 }}>*</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  const fg = "#241c00";
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        height: 46,
        padding: "0 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.85)",
        fontSize: 14,
        color: fg,
        fontFamily: "inherit",
        outline: "none",
        boxSizing: "border-box",
        border: "1px solid rgba(254, 210, 52, 0.4)",
        boxShadow: "none",
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "#cb9f01";
        e.target.style.boxShadow = "0 0 0 3px rgba(254,199,1,0.25)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "rgba(254,210,52,0.4)";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  const fg = "#241c00";
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid rgba(254,210,52,0.4)",
        background: "rgba(255,255,255,0.85)",
        fontSize: 14,
        color: fg,
        fontFamily: "inherit",
        outline: "none",
        boxSizing: "border-box",
        resize: "vertical",
        lineHeight: 1.5,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "#cb9f01";
        e.target.style.boxShadow = "0 0 0 3px rgba(254,199,1,0.25)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "rgba(254,210,52,0.4)";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}

function ChipGroup({ options, value, onChange, multi = true }) {
  const toggle = (opt) => {
    if (multi) {
      onChange(
        value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt],
      );
    } else {
      onChange(opt);
    }
  };
  const selected = (opt) => (multi ? value.includes(opt) : value === opt);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const sel = selected(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              border: sel
                ? "1.5px solid #cb9f01"
                : "1px solid rgba(254,210,52,0.35)",
              background: sel
                ? "linear-gradient(135deg, rgba(254,210,52,0.25), rgba(254,233,154,0.28))"
                : "rgba(255,255,255,0.6)",
              color: sel
                ? "#655001"
                : "#241c00",
              transition: "all 0.15s",
            }}
          >
            {sel && <span style={{ marginRight: 4 }}>✓</span>}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SubmitButton({ label, onClick, disabled, color = "#cb9f01" }) {
  const muted = "rgba(40,30,70,0.45)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: 54,
        borderRadius: 16,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: 0.5,
        fontFamily: "inherit",
        background: disabled
          ? "rgba(100,80,1,0.15)"
          : `linear-gradient(135deg, ${color}, ${color}C0)`,
        color: disabled ? muted : "#fff",
        boxShadow: disabled ? "none" : `0 8px 24px ${color}50`,
      }}
    >
      {label}
    </button>
  );
}

// Onboarding — profile setup for new users (after Google sign-in)
function ProfileScreen({ user, onBack, onEdit }) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "#FFFBE6";
  const cardBorder = "1px solid rgba(254,199,1,0.22)";
  const accent = "#cb9f01";

  const [idCopied, setIdCopied] = useState(false);
  const copyUserId = () => {
    if (!user?.id) return;
    try {
      navigator.clipboard && navigator.clipboard.writeText(user.id);
    } catch (err) { }
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 1800);
  };

  const COUNTRY_FLAG = {
    台灣: "🇹🇼",
    馬來西亞: "🇲🇾",
    新加坡: "🇸🇬",
    中國: "🇨🇳",
    香港: "🇭🇰",
    澳門: "🇲🇴",
    美國: "🇺🇸",
    其他: "🌏",
  };

  const rows = [
    { label: "中文姓名", value: user?.zhName, icon: "文" },
    { label: "英文姓名 English", value: user?.enName, icon: "A" },
    { label: "暱稱 Nickname", value: user?.nickname, icon: "✦" },
    { label: "Email", value: user?.email, icon: "@" },
    {
      label: "聯絡電話",
      value: user?.phone
        ? `${user.phoneCode || ""} ${user.phone}`.trim()
        : null,
      icon: "☎",
    },
    { label: "LINE ID", value: user?.lineId, icon: "L" },
    { label: "Telegram ID", value: user?.telegramId, icon: "T" },
    {
      label: "所在國家/地區",
      value: user?.country
        ? `${COUNTRY_FLAG[user.country] || ""} ${user.country}`.trim()
        : null,
      icon: "◎",
    },
    { label: "所在城市/地區", value: user?.location, icon: "◉" },
  ];

  const displayName = user?.nickname || user?.zhName || user?.name || "志工";
  const initial = (user?.zhName || user?.name || "U").slice(0, 1).toUpperCase();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 8px 6px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          position: "relative",
          zIndex: 2,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: fg,
            fontSize: 20,
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: fg, flex: 1 }}>
          個人資料
        </div>
        <button
          onClick={onEdit}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 999,
            border: `1px solid ${accent}60`,
            background: "rgba(254,199,1,0.2)",
            color: accent,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            marginRight: 8,
          }}
        >
          編輯
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          minHeight: 0,
          padding: "8px 16px 20px",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {/* Hero card */}
        <div
          style={{
            padding: "22px 18px",
            borderRadius: 22,
            background: "linear-gradient(160deg, #FFE48C 0%, #FFEEAD 55%, #FFF7D6 100%)",
            border: "1px solid rgba(254,199,1,0.3)",
            boxShadow: "0 8px 22px rgba(200,160,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: "linear-gradient(135deg, #fed234, #fec701)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 800,
              color: "#fff",
              boxShadow: "0 8px 22px rgba(254,199,1,0.4)",
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: fg,
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </div>
              {user?.id && (
                <button
                  type="button"
                  onClick={copyUserId}
                  title={idCopied ? "已複製" : "點擊複製 ID"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 9px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, "SF Mono", monospace',
                    letterSpacing: 0.3,
                    background: idCopied
                      ? "rgba(80,180,120,0.18)"
                      : "rgba(255,255,255,0.55)",
                    color: idCopied
                      ? "#2d8050"
                      : "rgba(90,70,0,0.85)",
                    border: "1px solid rgba(120,90,0,0.12)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                >
                  {user.id}
                  {idCopied ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            {user?.enName && (
              <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
                {user.enName}
              </div>
            )}
          </div>
        </div>

        {/* Field rows */}
        <div
          style={{
            borderRadius: 18,
            background: cardBg,
            border: cardBorder,
            overflow: "hidden",
          }}
        >
          {rows.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 14px",
                borderTop:
                  i === 0
                    ? "none"
                    : "1px solid rgba(254,199,1,0.12)",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: "rgba(254,199,1,0.18)",
                  color: accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {r.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: muted, fontWeight: 500 }}>
                  {r.label}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: r.value ? fg : muted,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.value || "尚未填寫"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Onboarding — profile setup for new users (after Google sign-in)
function ProfileSetupForm({
  user,
  initial,
  onCancel,
  onSubmit,
  title = "完善個人資料",
  subtitle = "初次加入，請填寫基本資訊，稍後可於「我的」中修改",
  submitLabel = "完成註冊",
}) {
  const bg = "#FFFDF5";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";
  const fg = "#241c00";

  const initEn =
    initial?.enName ||
    ((user?.name || "").match(/[A-Za-z\s]/) ? user.name : "");
  const initZh =
    initial?.zhName ||
    ((user?.name || "").match(/[\u4e00-\u9fa5]/) ? user.name : "");
  const [zhName, setZhName] = useState(initZh);
  const [enName, setEnName] = useState(initEn);
  const [nickname, setNickname] = useState(initial?.nickname || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [phoneCode, setPhoneCode] = useState(initial?.phoneCode || "+886");
  const [lineId, setLineId] = useState(initial?.lineId || "");
  const [telegramId, setTelegramId] = useState(initial?.telegramId || "");
  const [country, setCountry] = useState(initial?.country || "");
  const [location, setLocation] = useState(initial?.location || "");

  // Country → regions map
  const REGIONS = {
    台灣: [
      "台北",
      "新北",
      "基隆",
      "桃園",
      "新竹",
      "苗栗",
      "台中",
      "彰化",
      "南投",
      "雲林",
      "嘉義",
      "台南",
      "高雄",
      "屏東",
      "宜蘭",
      "花蓮",
      "台東",
      "澎湖",
      "金門",
      "馬祖",
    ],
    馬來西亞: [
      "吉隆坡",
      "雪蘭莪",
      "檳城",
      "柔佛",
      "霹靂",
      "森美蘭",
      "馬六甲",
      "吉打",
      "登嘉樓",
      "彭亨",
      "吉蘭丹",
      "沙巴",
      "砂拉越",
      "玻璃市",
      "納閩",
      "布城",
    ],
    新加坡: ["中區", "東區", "北區", "東北區", "西區"],
    中國: [
      "北京",
      "上海",
      "廣州",
      "深圳",
      "成都",
      "杭州",
      "南京",
      "武漢",
      "西安",
      "廈門",
      "福州",
      "青島",
      "其他城市",
    ],
    香港: ["港島", "九龍", "新界"],
    澳門: ["澳門半島", "氹仔", "路環"],
    美國: [
      "加州",
      "紐約",
      "德州",
      "華盛頓州",
      "伊利諾州",
      "麻州",
      "新澤西州",
      "佛羅里達州",
      "夏威夷",
      "其他州",
    ],
    其他: [],
  };
  const COUNTRY_DIAL = {
    台灣: "+886",
    馬來西亞: "+60",
    新加坡: "+65",
    中國: "+86",
    香港: "+852",
    澳門: "+853",
    美國: "+1",
    其他: "",
  };
  const DIAL_OPTIONS = [
    { code: "+886", label: "🇹🇼 +886" },
    { code: "+60", label: "🇲🇾 +60" },
    { code: "+65", label: "🇸🇬 +65" },
    { code: "+86", label: "🇨🇳 +86" },
    { code: "+852", label: "🇭🇰 +852" },
    { code: "+853", label: "🇲🇴 +853" },
    { code: "+1", label: "🇺🇸 +1" },
    { code: "+81", label: "🇯🇵 +81" },
    { code: "+82", label: "🇰🇷 +82" },
    { code: "+44", label: "🇬🇧 +44" },
    { code: "+61", label: "🇦🇺 +61" },
    { code: "+64", label: "🇳🇿 +64" },
    { code: "+66", label: "🇹🇭 +66" },
    { code: "+84", label: "🇻🇳 +84" },
    { code: "+62", label: "🇮🇩 +62" },
    { code: "+63", label: "🇵🇭 +63" },
    { code: "+91", label: "🇮🇳 +91" },
    { code: "+49", label: "🇩🇪 +49" },
    { code: "+33", label: "🇫🇷 +33" },
  ];

  const COUNTRIES = Object.keys(REGIONS);
  const regions = country ? REGIONS[country] : [];

  // Reset location when country changes
  const handleCountry = (v) => {
    setCountry(v);
    setLocation("");
    if (COUNTRY_DIAL[v]) setPhoneCode(COUNTRY_DIAL[v]);
  };

  const valid =
    zhName.trim() &&
    phone.trim() &&
    country &&
    (typeof location === "string" ? location.trim() : location);
  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  return (
    <FormShell
      bg={bg}
      title={title}
      subtitle={subtitle}
      onCancel={onCancel}
      footer={
        <SubmitButton
          label={submitLabel}
          onClick={() =>
            onSubmit({
              zhName: zhName.trim(),
              enName: enName.trim(),
              nickname: nickname.trim(),
              phone: phone.trim(),
              phoneCode: phoneCode,
              lineId: lineId.trim(),
              telegramId: telegramId.trim(),
              country: country,
              location: location,
            })
          }
          disabled={!valid}
          color="#fec701"
        />
      }
    >
      {/* Welcome card with avatar */}
      <div
        style={{
          padding: "16px 14px",
          borderRadius: 16,
          background: "rgba(254,199,1,0.18)",
          border: "1px solid rgba(254,199,1,0.35)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #fed234, #fec701)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(254,199,1,0.35)",
          }}
        >
          {(user?.name || "U").slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>
            {user?.name || "新志工"}
          </div>
          <div
            style={{
              fontSize: 11,
              color: muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.email}
          </div>
        </div>
      </div>

      <div style={card}>
        <FieldLabel required>
          中文姓名
        </FieldLabel>
        <TextInput
          value={zhName}
          onChange={setZhName}
          placeholder="請輸入你的中文姓名"
        />
      </div>

      <div style={card}>
        <FieldLabel>英文姓名</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          如證件上之拼音 As per NRIC（選填）
        </div>
        <TextInput
          value={enName}
          onChange={setEnName}
          placeholder="e.g. Chia-Yi Lin"
        />
      </div>

      <div style={card}>
        <FieldLabel>暱稱 Nickname</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          朋友們會這樣稱呼你（選填）
        </div>
        <TextInput
          value={nickname}
          onChange={setNickname}
          placeholder="e.g. 小佳 / Alice Ng"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          聯絡電話
        </FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              style={{
                height: 46,
                padding: "0 28px 0 12px",
                borderRadius: 12,
                border: "1px solid rgba(254, 210, 52, 0.4)",
                background: "rgba(255,255,255,0.85)",
                fontSize: 14,
                color: "#241c00",
                fontFamily: "inherit",
                outline: "none",
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
              }}
            >
              {DIAL_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                fontSize: 10,
                color: "rgba(50,40,0,0.6)",
              }}
            >
              ▾
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextInput
              value={phone}
              onChange={setPhone}
              placeholder="912-345-678"
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <FieldLabel>LINE ID</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          方便活動聯繫（選填）
        </div>
        <TextInput
          value={lineId}
          onChange={setLineId}
          placeholder="@your-line-id"
        />
      </div>

      <div style={card}>
        <FieldLabel>Telegram ID</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          方便活動聯繫（選填）
        </div>
        <TextInput
          value={telegramId}
          onChange={setTelegramId}
          placeholder="@your-telegram-id"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          所在國家/地區
        </FieldLabel>
        <ChipGroup
          options={COUNTRIES}
          value={country}
          onChange={handleCountry}
          multi={false}
        />
      </div>

      {country && (
        <div style={card}>
          <FieldLabel required>
            所在城市/地區
          </FieldLabel>
          <div
            style={{
              fontSize: 11,
              color: muted,
              marginBottom: 10,
              marginTop: -4,
            }}
          >
            {country === "其他" ? "請輸入你的國家與城市" : "請選擇主要活動地區"}
          </div>
          {country === "其他" ? (
            <TextInput
              value={location}
              onChange={setLocation}
              placeholder="e.g. Canada, Vancouver"
            />
          ) : (
            <ChipGroup
              options={regions}
              value={location}
              onChange={setLocation}
              multi={false}
            />
          )}
        </div>
      )}
    </FormShell>
  );
}

// Task 1 — Interest & skills form
function InterestForm({ onCancel, onSubmit }) {
  const bg = "#FFFDF5";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [interests, setInterests] = useState([]);
  const [skills, setSkills] = useState([]);
  const [availability, setAvailability] = useState([]);

  const valid =
    name.trim() &&
    phone.trim() &&
    interests.length > 0 &&
    availability.length > 0;
  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  return (
    <FormShell
      bg={bg}
      title="填寫志工表單"
      subtitle="填寫個人資訊、興趣與可投入時段"
      onCancel={onCancel}
      footer={
        <SubmitButton
          label="提交表單"
          onClick={onSubmit}
          disabled={!valid}
          color="#fec701"
        />
      }
    >
      <div style={card}>
        <FieldLabel required>
          姓名
        </FieldLabel>
        <TextInput
          value={name}
          onChange={setName}
          placeholder="請輸入你的姓名"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          聯絡電話
        </FieldLabel>
        <TextInput
          value={phone}
          onChange={setPhone}
          placeholder="09xx-xxxxxx"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          興趣方向
        </FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          可複選
        </div>
        <ChipGroup
          options={[
            "活動策劃",
            "接待導覽",
            "文宣設計",
            "攝影紀錄",
            "物資管理",
            "陪伴關懷",
            "翻譯協助",
            "其他",
          ]}
          value={interests}
          onChange={setInterests}
          multi
        />
      </div>

      <div style={card}>
        <FieldLabel>專長技能</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          可複選，協助我們配對合適的任務
        </div>
        <ChipGroup
          options={[
            "領導統籌",
            "設計美編",
            "活動企劃",
            "影像剪輯",
            "外語",
            "文案寫作",
            "資料分析",
            "樂器演奏",
          ]}
          value={skills}
          onChange={setSkills}
          multi
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          可投入時段
        </FieldLabel>
        <ChipGroup
          options={["平日白天", "平日晚上", "週末白天", "週末晚上"]}
          value={availability}
          onChange={setAvailability}
          multi
        />
      </div>
    </FormShell>
  );
}

// Task 2 — Ticket form
function TicketForm({ onCancel, onSubmit }) {
  const bg = "#FFFDF5";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";
  const muted = "rgba(50,40,0,0.6)";

  const [name, setName] = useState("");
  const [ticket725, setTicket725] = useState("");
  const [ticket726, setTicket726] = useState("");
  const [note, setNote] = useState("");

  const valid = name.trim() && ticket725.trim() && ticket726.trim();
  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  return (
    <FormShell
      bg={bg}
      title="夏季盛會報名"
      subtitle="請輸入 7/25 與 7/26 場次票券編號"
      onCancel={onCancel}
      footer={
        <SubmitButton
          label="提交報名"
          onClick={onSubmit}
          disabled={!valid}
          color="#8AD4B0"
        />
      }
    >
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 16,
          background:
            "linear-gradient(135deg, rgba(138,212,176,0.18), rgba(138,212,176,0.08))",
          border: `1px solid ${"rgba(138,212,176,0.4)"}`,
          fontSize: 12,
          color: "#2E7B5A",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>📅 夏季盛會資訊</div>
        7 月 25 日（六）·活動一日場
        <br />7 月 26 日（日）·活動二日場
      </div>

      <div style={card}>
        <FieldLabel required>
          姓名
        </FieldLabel>
        <TextInput
          value={name}
          onChange={setName}
          placeholder="請輸入你的姓名"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          7/25 票券編號
        </FieldLabel>
        <TextInput
          value={ticket725}
          onChange={setTicket725}
          placeholder="例如：RL-0725-8420"
        />
        <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
          可於購票 Email 或錢包中找到 12 位編號
        </div>
      </div>

      <div style={card}>
        <FieldLabel required>
          7/26 票券編號
        </FieldLabel>
        <TextInput
          value={ticket726}
          onChange={setTicket726}
          placeholder="例如：RL-0726-1173"
        />
      </div>

      <div style={card}>
        <FieldLabel>備註</FieldLabel>
        <Textarea
          value={note}
          onChange={setNote}
          placeholder="飲食需求、交通協助等（可留白）"
        />
      </div>
    </FormShell>
  );
}

// Mock member pool & teams
const MOCK_MEMBERS = [
  {
    id: "u1",
    name: "林詠瑜",
    role: "設計美編",
    avatar: "linear-gradient(135deg, #fed234, #fec701)",
  },
  {
    id: "u2",
    name: "陳志豪",
    role: "影像剪輯",
    avatar: "linear-gradient(135deg, #fec701, #B8A4E3)",
  },
  {
    id: "u3",
    name: "王美玲",
    role: "活動企劃",
    avatar: "linear-gradient(135deg, #8AD4B0, #fec701)",
  },
  {
    id: "u4",
    name: "張書豪",
    role: "外語·翻譯",
    avatar: "linear-gradient(135deg, #fed234, #fed234)",
  },
  {
    id: "u5",
    name: "李佳穎",
    role: "文案寫作",
    avatar: "linear-gradient(135deg, #FFD6A8, #fed234)",
  },
  {
    id: "u6",
    name: "黃宇軒",
    role: "攝影紀錄",
    avatar: "linear-gradient(135deg, #B8A4E3, #8AD4B0)",
  },
  {
    id: "u7",
    name: "吳雅萱",
    role: "接待導覽",
    avatar: "linear-gradient(135deg, #fec701, #fec701)",
  },
  {
    id: "u8",
    name: "蔡承恩",
    role: "資料分析",
    avatar: "linear-gradient(135deg, #fec701, #8AD4B0)",
  },
];

const MOCK_TEAMS = [
  {
    id: "T-MING2024",
    name: "星河守望隊",
    leader: "周明蓁",
    leaderId: "UMING",
    topic: "長者陪伴",
    members: 3,
    cap: 5,
    points: 1840,
    weekPoints: 280,
    rank: 3,
    leaderAvatar: "linear-gradient(135deg, #fed234, #fec701)",
  },
  {
    id: "T-WEI8810",
    name: "光點行動組",
    leader: "許子瑋",
    leaderId: "UWEI",
    topic: "社區導覽",
    members: 4,
    cap: 5,
    points: 2120,
    weekPoints: 360,
    rank: 2,
    leaderAvatar: "linear-gradient(135deg, #fec701, #B8A4E3)",
  },
  {
    id: "T-TING0517",
    name: "綠意日常",
    leader: "鄭宜庭",
    leaderId: "UTING",
    topic: "環境關懷",
    members: 2,
    cap: 4,
    points: 960,
    weekPoints: 140,
    rank: 5,
    leaderAvatar: "linear-gradient(135deg, #8AD4B0, #FFD6A8)",
  },
  {
    id: "T-CHU1109",
    name: "童心共讀",
    leader: "劉雅筑",
    leaderId: "UCHU",
    topic: "兒童陪讀",
    members: 5,
    cap: 5,
    points: 2680,
    weekPoints: 420,
    rank: 1,
    leaderAvatar: "linear-gradient(135deg, #fed234, #FFD6A8)",
  },
];

// Task 3 — Join a team (search by team ID, name, or leader)
function TeamForm({ onCancel, onSubmit }) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

  const [teamQuery, setTeamQuery] = useState("");
  const [pendingJoin, setPendingJoin] = useState(null);

  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  const q = teamQuery.trim().toUpperCase();
  const filteredTeams = MOCK_TEAMS.filter(
    (t) =>
      q === "" ||
      t.id.toUpperCase().includes(q) ||
      t.name.includes(teamQuery) ||
      t.leader.includes(teamQuery) ||
      t.topic.includes(teamQuery),
  );

  const valid = pendingJoin != null;

  const handleSubmit = () => {
    const t = MOCK_TEAMS.find((x) => x.id === pendingJoin);
    if (!t) return;
    // Populate with a few mock members so the team view feels real
    const mockMemberPool = [
      {
        id: "m-a",
        name: "林詠瑜",
        avatar: "linear-gradient(135deg, #fed234, #fec701)",
      },
      {
        id: "m-b",
        name: "陳志豪",
        avatar: "linear-gradient(135deg, #fec701, #B8A4E3)",
      },
      {
        id: "m-c",
        name: "王美玲",
        avatar: "linear-gradient(135deg, #8AD4B0, #fec701)",
      },
      {
        id: "m-d",
        name: "張書維",
        avatar: "linear-gradient(135deg, #FFC170, #F39770)",
      },
    ];

    const mockMembers = mockMemberPool.slice(
      0,
      Math.max(0, (t.members || 1) - 1),
    );
    onSubmit({
      id: t.id,
      status: "pending",
      name: t.name,
      topic: t.topic,
      leader: { id: t.leaderId, name: t.leader, avatar: t.leaderAvatar },
      members: mockMembers,
      currentCount: t.members,
      cap: t.cap,
      points: t.points,
      weekPoints: t.weekPoints,
      rank: t.rank,
    });
  };

  return (
    <FormShell
      bg={bg}
      title="加入團隊"
      subtitle="輸入團隊編號或搜尋名稱，向組長送出申請"
      onCancel={onCancel}
      footer={
        <SubmitButton
          label={valid ? "送出加入申請" : "請先選擇團隊"}
          onClick={handleSubmit}
          disabled={!valid}
          color="#6dae4a"
        />
      }
    >
      <div style={card}>
        <FieldLabel required>
          團隊編號 / 名稱
        </FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          例如：T-MING2024、星河守望隊、周明蓁
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              color: muted,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            type="text"
            value={teamQuery}
            onChange={(e) => setTeamQuery(e.target.value)}
            placeholder="輸入團隊編號或關鍵字"
            style={{
              width: "100%",
              height: 44,
              padding: "0 14px 0 38px",
              borderRadius: 12,
              border: "1px solid rgba(109,174,74,0.4)",
              background: "rgba(255,255,255,0.9)",
              fontSize: 13,
              color: fg,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              letterSpacing: 0.3,
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredTeams.length === 0 ? (
            <div
              style={{
                padding: "24px 12px",
                textAlign: "center",
                color: muted,
                fontSize: 12,
                border: "1px dashed rgba(109,174,74,0.35)",
                borderRadius: 12,
                lineHeight: 1.6,
              }}
            >
              找不到符合的團隊
              <br />
              <span style={{ fontSize: 11 }}>請確認團隊編號是否正確</span>
            </div>
          ) : (
            filteredTeams.map((team) => {
              const isPending = pendingJoin === team.id;
              return (
                <div
                  key={team.id}
                  onClick={() => setPendingJoin(isPending ? null : team.id)}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: isPending
                      ? "linear-gradient(135deg, rgba(168,214,128,0.3), rgba(109,174,74,0.22))"
                      : "rgba(255,255,255,0.6)",
                    border: isPending
                      ? "1.5px solid rgba(109,174,74,0.65)"
                      : "1px solid rgba(109,174,74,0.25)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: team.leaderAvatar,
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 700,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {team.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>
                        {team.name}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: 0.4,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "rgba(168,214,128,0.35)",
                          color: "#3d7a2e",
                          fontFamily: "monospace",
                        }}
                      >
                        {team.id}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                      組長：{team.leader}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: isPending
                        ? "transparent"
                        : "linear-gradient(135deg, #8dc968, #6dae4a)",
                      border: isPending ? "1.5px solid #4e9a2e" : "none",
                      color: isPending ? "#3d7a2e" : "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {isPending ? "✓ 已選" : "選擇"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </FormShell>
  );
}

// Success overlay after submission
function FormSuccessOverlay({
  color = "#cb9f01",
  points,
  bonus,
  title = "任務完成！",
  onDone,
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(20,15,40,0.75)",
        backdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "32px 40px",
          animation: "fadeInUp 0.5s ease",
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${color}, ${color}C0)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 54,
            color: "#fff",
            margin: "0 auto 18px",
            boxShadow: `0 12px 36px ${color}60`,
            animation: "fadeInUp 0.5s 0.1s ease backwards",
          }}
        >
          ✓
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: 0.3,
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        {points > 0 && (
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#fedd67",
              marginBottom: 4,
            }}
          >
            ＋{points} 星點
          </div>
        )}
        {bonus && (
          <div
            style={{
              fontSize: 13,
              color: "#FFE8B8",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              textAlign: "center",
              maxWidth: 260,
            }}
          >
            <span>🎁</span> {bonus}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState("landing");
  const [rewardsFrom, setRewardsFrom] = useState("home");
  const navigateTo = (next) => {
    if (next === "rewards") setRewardsFrom(screen === "me" ? "me" : "home");
    setScreen(next);
  };
  const [user, setUser] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [tasks, setTasks] = useState(TASKS);
  const [successData, setSuccessData] = useState(null);
  const [ledTeam, setLedTeam] = useState(null);
  const [joinedTeam, setJoinedTeam] = useState(null);

  const openTask = (id) => {
    setCurrentTaskId(id);
    setScreen("taskDetail");
  };
  const openTaskForm = (id) => {
    setCurrentTaskId(id);
    setScreen("form");
  };

  const userIdFromEmail = (email) =>
    "U" +
    (email || "guest@x.com")
      .split("@")[0]
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6)
      .padEnd(4, "0");

  const handleSignIn = (rawUser) => {
    const uid = userIdFromEmail(rawUser.email);
    const fullUser = { ...rawUser, id: uid };
    setUser(fullUser);
    // Route new users to profile setup first
    setScreen("profileSetup");
  };

  const handleProfileComplete = (profile) => {
    setUser((prev) => {
      const merged = {
        ...prev,
        name: profile.zhName || prev.name,
        zhName: profile.zhName,
        enName: profile.enName,
        nickname: profile.nickname,
        phone: profile.phone,
        phoneCode: profile.phoneCode,
        lineId: profile.lineId,
        telegramId: profile.telegramId,
        country: profile.country,
        location: profile.location,
      };
      const displayName = merged.name;
      // Auto-create the user's own team
      const myTeam = {
        id: "T-" + prev.id.replace(/^U/, ""),
        role: "leader",
        name: `${displayName}的團隊`,
        topic: "尚未指定主題",
        leader: {
          id: prev.id,
          name: displayName,
          avatar: "linear-gradient(135deg, #fed234, #fec701, #fec701)",
        },
        members: [],
        requests: [
          {
            id: "req1",
            name: "林詠瑜",
            avatar: "linear-gradient(135deg, #fed234, #fec701)",
          },
          {
            id: "req2",
            name: "陳志豪",
            avatar: "linear-gradient(135deg, #fec701, #B8A4E3)",
          },
          {
            id: "req3",
            name: "王美玲",
            avatar: "linear-gradient(135deg, #8AD4B0, #fec701)",
          },
        ],
      };
      setLedTeam(myTeam);
      syncTeamTask(myTeam, null);
      setScreen("home");
      return merged;
    });
  };

  const handleProfileUpdate = (profile) => {
    setUser((prev) => ({
      ...prev,
      name: profile.zhName || prev.name,
      zhName: profile.zhName,
      enName: profile.enName,
      nickname: profile.nickname,
      phone: profile.phone,
      phoneCode: profile.phoneCode,
      lineId: profile.lineId,
      telegramId: profile.telegramId,
      country: profile.country,
      location: profile.location,
    }));
    setScreen("profile");
  };

  const handleSignOut = () => {
    setUser(null);
    setLedTeam(null);
    setJoinedTeam(null);
    setScreen("landing");
  };

  // Compute team progress for task 3 from BOTH teams
  const syncTeamTask = (led, joined) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === 3);
      if (idx < 0) return prev;
      const t = prev[idx];
      const cap = t.cap || 6;
      const ledTotal = led ? led.members.length + 1 : 0;
      const joinedTotal =
        joined && joined.status === "approved"
          ? (joined.currentCount || 0) + 1
          : 0;
      // Highest total wins for the task
      const total = Math.max(ledTotal, joinedTotal);
      const complete = total >= cap;
      const updated = {
        ...t,
        status:
          !led && !joined ? "todo" : complete ? "completed" : "in_progress",
        progress: Math.min(1, total / cap),
        teamProgress:
          led || joined ? { total, cap, ledTotal, joinedTotal } : null,
      };
      const n = [...prev];
      n[idx] = updated;
      return n;
    });
  };

  // Joining a team only — every user already leads their own team
  const joinTeam = (teamData) => {
    const newTeam = { ...teamData, role: "member" };
    setJoinedTeam(newTeam);
    syncTeamTask(ledTeam, newTeam);
    setSuccessData({
      color: "#6dae4a",
      points: 0,
      bonus: `已向「${newTeam.name}」送出申請，等待組長審核`,
      title: "申請已送出！",
    });
    setScreen("me");
  };

  const leaveLedTeam = () => {
    setLedTeam(null);
    syncTeamTask(null, joinedTeam);
  };
  const leaveJoinedTeam = () => {
    setJoinedTeam(null);
    syncTeamTask(ledTeam, null);
  };

  const approveRequest = (reqId) => {
    if (!ledTeam) return;
    const req = (ledTeam.requests || []).find((r) => r.id === reqId);
    if (!req) return;
    const updated = {
      ...ledTeam,
      members: [
        ...ledTeam.members,
        { id: req.id, name: req.name, avatar: req.avatar },
      ],
      requests: ledTeam.requests.filter((r) => r.id !== reqId),
    };
    setLedTeam(updated);
    syncTeamTask(updated, joinedTeam);
    if (updated.members.length + 1 >= 6) {
      const t3 = tasks.find((x) => x.id === 3);
      setSuccessData({
        color: t3.color,
        points: t3.points,
        bonus: t3.bonus,
        title: "組隊完成！",
      });
    }
  };

  const rejectRequest = (reqId) => {
    if (!ledTeam) return;
    setLedTeam({
      ...ledTeam,
      requests: (ledTeam.requests || []).filter((r) => r.id !== reqId),
    });
  };

  const renameTeam = (alias) => {
    if (!ledTeam) return;
    setLedTeam({ ...ledTeam, alias });
  };

  // Demo helper: simulate a member's request being approved externally
  const simulateJoinApproved = () => {
    if (!joinedTeam || joinedTeam.status !== "pending") return;
    const approved = { ...joinedTeam, status: "approved" };
    setJoinedTeam(approved);
    syncTeamTask(ledTeam, approved);
  };

  const completeTask = (id) => {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const t = tasks[idx];
    const updated = {
      ...t,
      status: "completed",
      steps: (t.steps || []).map((s) => ({ ...s, done: true })),
      progress: 1,
    };
    const newTasks = [...tasks];
    newTasks[idx] = updated;
    setTasks(newTasks);
    setScreen("taskDetail");
    setSuccessData({ color: t.color, points: t.points, bonus: t.bonus });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        background: "#F2ECDC",
        fontFamily: '"Noto Sans SC", "PingFang SC", -apple-system, sans-serif',
        overflow: "hidden",
      }}
    >
      <GlobalStyles />
      {screen === "landing" && (
        <LandingScreen
          onStart={() => setScreen("auth")}
        />
      )}
      {screen === "auth" && (
        <GoogleAuthScreen
          onCancel={() => setScreen("landing")}
          onSuccess={handleSignIn}
        />
      )}
      {screen === "profileSetup" && (
        <ProfileSetupForm
          user={user}
          onCancel={() => {
            setUser(null);
            setScreen("landing");
          }}
          onSubmit={handleProfileComplete}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          user={user}
          onBack={() => setScreen("me")}
          onEdit={() => setScreen("profileEdit")}
        />
      )}
      {screen === "profileEdit" && (
        <ProfileSetupForm
          user={user}
          initial={user}
          title="編輯個人資料"
          subtitle="更新你的基本資訊"
          submitLabel="儲存變更"
          onCancel={() => setScreen("profile")}
          onSubmit={handleProfileUpdate}
        />
      )}
      {screen === "home" && (
        <HomeScreen
          user={user}
          tasks={tasks}
          onSignOut={handleSignOut}
          onNavigate={navigateTo}
          onOpenTask={openTask}
        />
      )}
      {screen === "tasks" && (
        <TasksScreen
          tasks={tasks}
          onNavigate={setScreen}
          onOpenTask={openTask}
        />
      )}
      {screen === "rank" && (
        <RankScreen
          user={user}
          tasks={tasks}
          onNavigate={setScreen}
        />
      )}
      {screen === "taskDetail" && (
        <TaskDetailScreen
          tasks={tasks}
          taskId={currentTaskId}
          onBack={() => setScreen("tasks")}
          onOpenTask={openTask}
          onStartTask={openTaskForm}
          onGoMe={() => setScreen("me")}
        />
      )}
      {screen === "form" && currentTaskId === 1 && (
        <InterestForm
          onCancel={() => setScreen("taskDetail")}
          onSubmit={() => completeTask(1)}
        />
      )}
      {screen === "form" && currentTaskId === 2 && (
        <TicketForm
          onCancel={() => setScreen("taskDetail")}
          onSubmit={() => completeTask(2)}
        />
      )}
      {screen === "form" && currentTaskId === 3 && (
        <TeamForm
          onCancel={() => setScreen("me")}
          onSubmit={joinTeam}
        />
      )}
      {screen === "me" && (
        <MyScreen
          user={user}
          ledTeam={ledTeam}
          joinedTeam={joinedTeam}
          tasks={tasks}
          onSignOut={handleSignOut}
          onNavigate={navigateTo}
          onBuildTeam={() => {
            setCurrentTaskId(3);
            setScreen("form");
          }}
          onApproveRequest={approveRequest}
          onRejectRequest={rejectRequest}
          onRenameTeam={renameTeam}
          onCancelJoinRequest={leaveJoinedTeam}
          onLeaveLedTeam={leaveLedTeam}
          onLeaveJoinedTeam={leaveJoinedTeam}
          onSimulateJoinApproved={simulateJoinApproved}
          onOpenTask={openTask}
        />
      )}
      {screen === "rewards" && (
        <RewardsScreen
          user={user}
          tasks={tasks}
          onBack={() => setScreen(rewardsFrom)}
        />
      )}
      {successData && (
        <FormSuccessOverlay
          {...successData}
          onDone={() => setSuccessData(null)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
