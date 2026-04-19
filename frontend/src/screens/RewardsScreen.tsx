import { useRouter } from "@tanstack/react-router";
import { useAppState } from "../state/AppStateContext";
import { fs } from "../utils";
import { ChevronLeftIcon } from "../ui/Icon";
import MyRewards from "./MyRewards";

export default function RewardsScreen() {
  const router = useRouter();
  const onBack = () => router.history.back();
  const { user, tasks } = useAppState();
  const bg = "var(--bg)";
  const fg = "var(--fg)";
  const muted = "var(--muted)";
  const cardBg = "#FFFBE6";
  const cardBorder = "1px solid rgba(254,199,1,0.22)";

  const totalPoints = tasks
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
        color: "var(--fg)",
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
          type="button"
          aria-label="返回"
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
          }}
        >
          <ChevronLeftIcon size={22} />
        </button>
        <div style={{ fontSize: fs(16), fontWeight: 700, color: fg, flex: 1 }}>我的獎勵</div>
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
            boxShadow: "var(--shadow-2)",
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
              return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="#fec701" />;
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
                background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: fs(26),
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
                  fontSize: fs(11),
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
                    fontSize: fs(36),
                    fontWeight: 900,
                    letterSpacing: -1,
                    fontFamily: "var(--font-serif)",
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
