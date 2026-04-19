import MyRewards from "./MyRewards";
import type { User, Task } from "../types";

type Props = {
  user: User | null;
  tasks: Task[];
  onBack: () => void;
};

export default function RewardsScreen({ user, tasks, onBack }: Props) {
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
        <div style={{ fontSize: 16, fontWeight: 700, color: fg, flex: 1 }}>我的獎勵</div>
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
