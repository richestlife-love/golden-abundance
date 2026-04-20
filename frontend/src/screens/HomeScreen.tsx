import { useNavigate } from "@tanstack/react-router";
import { useMe } from "../hooks/useMe";
import { useMyTasks } from "../hooks/useMyTasks";
import { useAuth } from "../auth/session";
import { getEffectiveStatus, fs } from "../utils";
import BottomNav from "../ui/BottomNav";
import { BabyIcon, CrownIcon, MedalIcon, StarIcon } from "../ui/Icon";
import { useCountUp } from "../ui/useCountUp";
import TaskCard from "./TaskCard";

export default function HomeScreen() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const { data: tasks } = useMyTasks();
  const { signOut } = useAuth();
  const onSignOut = () => {
    void signOut();
  };
  const onOpenTask = (displayId: string) =>
    navigate({ to: "/tasks/$taskId", params: { taskId: displayId } });

  const bg = "var(--bg)";
  const activeTasks = tasks.filter((t) => {
    const { status } = getEffectiveStatus(t, tasks);
    return status === "todo" || status === "in_progress" || status === "locked";
  });

  const cardBg = "var(--card)";
  const cardBorder = "1px solid var(--card-strong)";
  const muted = "var(--muted)";
  const fg = "var(--fg)";

  // Star points + tier progress (mirrors MyRewards tier thresholds)
  const totalPoints = tasks
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.points, 0);
  const displayPoints = useCountUp(totalPoints);
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
    ? Math.min(1, Math.max(0, (totalPoints - homePrevReq) / Math.max(1, homeNextReq - homePrevReq)))
    : 1;

  const avatarSolid = user.avatar_url ?? "#fec701";

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
            <div style={{ fontSize: fs(13), color: muted, marginBottom: 2 }}>欢迎回来</div>
            <div
              style={{
                fontSize: fs(16),
                fontWeight: 600,
                color: fg,
                letterSpacing: 0.3,
              }}
            >
              金富有 · 志工
            </div>
          </div>
          <button
            type="button"
            aria-label="登出"
            onClick={onSignOut}
            title="登出"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${avatarSolid}, ${avatarSolid}CC)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: fs(16),
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              border: "none",
              padding: 0,
              font: "inherit",
            }}
          >
            {(user.name || "你")[0]}
          </button>
        </div>

        {/* Points card */}
        <button
          type="button"
          aria-label="查看獎勵"
          onClick={() => navigate({ to: "/rewards" })}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            font: "inherit",
            color: "inherit",
            borderRadius: 22,
            background: "linear-gradient(135deg, #FFF9DC 0%, #FFE892 70%, #FFDB5E 100%)",
            border: "1px solid rgba(254,199,1,0.4)",
            padding: "18px 20px 16px",
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
            cursor: "pointer",
            boxShadow: "var(--shadow-2), var(--shadow-inset-hi)",
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
          {/* Sheen sweep — the "moment": a diagonal highlight passes across
              the card on mount and loops every 7s. Gives the card a sense of
              polished metal catching light. */}
          <div
            className="ga-sheen"
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              borderRadius: "inherit",
              pointerEvents: "none",
            }}
          >
            <div
              className="ga-sheen"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: "45%",
                background:
                  "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.55) 55%, transparent 100%)",
                animation: "sheenSweep 7s cubic-bezier(0.4, 0, 0.2, 1) 0.6s infinite",
                filter: "blur(2px)",
                mixBlendMode: "screen",
              }}
            />
          </div>

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
                  fontSize: fs(28),
                  fontWeight: 800,
                  color: "#3a2800",
                  fontFamily: "var(--font-serif)",
                  letterSpacing: 0.5,
                  lineHeight: 1,
                }}
              >
                {user.name || "朋友"}
              </div>
              {/* Tier below name */}
              {(() => {
                const tierName = homeCurrentTier?.name || "志工寶寶";
                const tierColor = homeCurrentTier?.color || "#b8a4e3";
                const isBaby = !homeCurrentTier;
                const tierTextColor = isBaby ? "#8c4a9a" : tierColor;
                return (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: fs(13),
                      fontWeight: 800,
                      color: tierTextColor,
                      letterSpacing: 0.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isBaby ? <BabyIcon size={15} /> : <MedalIcon size={15} />}
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
                    background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    boxShadow: "0 2px 6px rgba(254,199,1,0.45)",
                  }}
                >
                  <StarIcon size={9} />
                </span>
                <div
                  style={{
                    fontSize: fs(11),
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
                    fontSize: fs(52),
                    fontWeight: 600,
                    letterSpacing: -0.5,
                    background: "linear-gradient(135deg, #cb9f01 0%, #fec701 45%, #cb9f01 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontFamily: "var(--font-display)",
                    lineHeight: 1,
                    textShadow: "0 2px 4px rgba(200,160,0,0.15)",
                  }}
                >
                  {displayPoints.toLocaleString()}
                </div>
                <div
                  style={{
                    color: "#cb9f01",
                    lineHeight: 1,
                    filter: "drop-shadow(0 2px 4px rgba(200,160,0,0.15))",
                    display: "inline-flex",
                  }}
                >
                  <StarIcon size={28} />
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
                      {ticks.map((t) => {
                        const reached = totalPoints >= t.value;
                        return (
                          <div
                            key={t.pct}
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
                              border: reached ? "2px solid #fff" : "2px solid rgba(203,159,1,0.35)",
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
                              <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
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
                      {ticks.map((t) => (
                        <div
                          key={t.pct}
                          style={{
                            position: "absolute",
                            left: `${t.pct * 100}%`,
                            transform: "translateX(-50%)",
                            fontSize: fs(9.5),
                            fontWeight: 700,
                            color: totalPoints >= t.value ? "#8c6d00" : muted,
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
                  fontSize: fs(12),
                  fontWeight: 700,
                  color: "#6B4FA8",
                }}
              >
                <CrownIcon size={15} />
                已達最高等級·金牌志工
              </div>
            )}
          </div>
        </button>

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
          <div style={{ fontSize: fs(16), fontWeight: 700, color: fg }}>探索任务</div>
          <button
            type="button"
            onClick={() => navigate({ to: "/tasks" })}
            style={{
              fontSize: fs(12),
              color: muted,
              cursor: "pointer",
              border: "none",
              background: "transparent",
              padding: 0,
              font: "inherit",
              fontFamily: "inherit",
            }}
          >
            查看全部 →
          </button>
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
                fontSize: fs(13),
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
      <BottomNav muted={muted} />
    </div>
  );
}
