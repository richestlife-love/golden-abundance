import { useState } from "react";
import type { MouseEvent, KeyboardEvent } from "react";
import BottomNav from "../ui/BottomNav";
import TeamCard from "./TeamCard";
import type { User, Team, Task, ScreenId } from "../types";

type Props = {
  user: User | null;
  ledTeam: Team | null;
  joinedTeam: Team | null;
  tasks: Task[];
  onSignOut: () => void;
  onNavigate: (screen: ScreenId) => void;
  onBuildTeam: () => void;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onRenameTeam: (alias: string) => void;
  onCancelJoinRequest: () => void;
  onLeaveLedTeam: () => void;
  onLeaveJoinedTeam: () => void;
  onSimulateJoinApproved: () => void;
  onOpenTask: (id: number) => void;
};

export default function MyScreen({
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
}: Props) {
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
    ? (joinedTeam.currentCount || 0) + (joinedTeam.status === "approved" ? 1 : 0)
    : 0;
  const [teamTab, setTeamTab] = useState(ledTeam && !joinedTeam ? "leader" : "member");
  const [userIdCopied, setUserIdCopied] = useState(false);
  const copyUserId = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user?.id) return;
    try {
      navigator.clipboard && navigator.clipboard.writeText(user.id);
    } catch (err) {}
    setUserIdCopied(true);
    setTimeout(() => setUserIdCopied(false), 1800);
  };

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
            boxShadow:
              "0 10px 30px rgba(200,160,0,0.14), 0 2px 6px rgba(184,164,227,0.12), inset 0 1px 0 rgba(255,255,255,0.7)",
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
                <stop offset="0%" stopColor={"#d9c8f5"} stopOpacity="0.3" />
                <stop offset="100%" stopColor={"#d9c8f5"} stopOpacity="0" />
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
                <circle r={r + 0.4} fill={"#fec701"} opacity="0.7" />
                <circle r={r * 0.3} fill="#fff" />
              </g>
            ))}
            {/* crescent moon */}
            <g transform="translate(340,52)">
              <circle r="14" fill={"rgba(254,199,1,0.35)"} />
              <circle r="14" cx="5" cy="-2" fill={"#FFE48C"} />
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
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {/* Avatar with halo ring */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                style={{
                  position: "absolute",
                  inset: -5,
                  borderRadius: 999,
                  background: "conic-gradient(from 180deg, #fed234, #b8a4e3, #fed234)",
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
                  boxShadow: "0 8px 22px rgba(254,199,1,0.4), inset 0 2px 0 rgba(255,255,255,0.4)",
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
                      background: userIdCopied ? "rgba(80,180,120,0.18)" : "rgba(255,255,255,0.55)",
                      color: userIdCopied ? "#2d8050" : "rgba(90,70,0,0.85)",
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
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
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
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.35)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
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
                    color: active ? t.color : "rgba(120,90,0,0.45)",
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
                    onCancelRequest={onCancelJoinRequest}
                    onLeaveTeam={onLeaveJoinedTeam}
                    onOpenTeamTask={() => onOpenTask(3)}
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
                    onClick={() => onOpenTask(3)}
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
                  onApproveRequest={onApproveRequest}
                  onRejectRequest={onRejectRequest}
                  onRenameTeam={onRenameTeam}
                  onLeaveTeam={onLeaveLedTeam}
                  onOpenTeamTask={() => onOpenTask(3)}
                />
              )}
            </div>
          )}
        </div>

        {/* Account menu list removed — logout moved to top bar */}
      </div>

      <BottomNav current="me" muted={muted} onNavigate={onNavigate} />
    </div>
  );
}
