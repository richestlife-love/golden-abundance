import { getEffectiveStatus } from "../utils";
import { TASKS } from "../data";
import type { Task } from "../types";

type Props = {
  tasks: Task[];
  taskId: number | null;
  onBack: () => void;
  onOpenTask: (id: number) => void;
  onStartTask: (id: number) => void;
  onGoMe: () => void;
};

export default function TaskDetailScreen({
  tasks: tasksProp,
  taskId,
  onBack,
  onOpenTask,
  onStartTask,
  onGoMe,
}: Props) {
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
  const urgent = status === "todo" && t.daysLeft != null && t.daysLeft > 0 && t.daysLeft <= 7;

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
      onOpenTask(unmet[0]);
      return;
    }
    // Team task — route to 我的 page for team management
    if (isTeamTask) {
      onGoMe();
      return;
    }
    // Route to the correct form based on task id
    onStartTask(t.id);
  };

  const prereqTasks = (t.requires || [])
    .map((rid) => tasks.find((x) => x.id === rid))
    .filter((p): p is Task => p !== undefined);

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
            type="button"
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
            type="button"
            aria-label="分享"
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
                <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}>星點</span>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>前置任務</div>
                <div style={{ fontSize: 11, color: muted, marginLeft: "auto" }}>
                  {prereqTasks.filter((p) => p.status === "completed").length}/{prereqTasks.length}{" "}
                  已完成
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prereqTasks.map((p) => {
                  const done = p.status === "completed";
                  return (
                    <div
                      key={p.id}
                      onClick={() => onOpenTask(p.id)}
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
                        {done ? "已完成" : p.status === "in_progress" ? "進行中" : "待開始"}
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
                border: teamHasTeam ? "1px solid rgba(254,199,1,0.4)" : cardBorder,
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>組隊進度</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>
                    {teamHasTeam ? "集滿至少 6 人即可完成任務" : "尚未建立團隊"}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: teamHasTeam && teamState.total >= teamState.cap ? "#2E9B65" : fg,
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
                        border: filled ? "none" : "1.5px dashed rgba(254,210,52,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: filled ? "#fff" : muted,
                        boxShadow: filled ? "0 3px 10px rgba(254,199,1,0.35)" : "none",
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
                  還差 <strong style={{ color: fg }}>{teamState.cap - teamState.total}</strong>{" "}
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
                <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>步驟進度</div>
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
                {(t.steps || []).map((s, i) => (
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
                        border: s.done ? "none" : `1.5px solid ${"rgba(120,110,150,0.3)"}`,
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
            type="button"
            onClick={onCta}
            disabled={cta.disabled}
            style={{
              width: "100%",
              height: 54,
              borderRadius: 16,
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
              color: cta.disabled ? muted : cta.tone === "secondary" ? fg : "#fff",
              border: cta.tone === "secondary" ? `1.5px solid ${t.color}` : "none",
              boxShadow: cta.disabled ? "none" : `0 8px 24px ${t.color}50`,
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseDown={(e) => !cta.disabled && (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => !cta.disabled && (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => !cta.disabled && (e.currentTarget.style.transform = "scale(1)")}
          >
            {cta.label}
          </button>
        </div>
      </div>
    </div>
  );
}
