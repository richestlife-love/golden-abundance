import { avatarBg, fs, hashString } from "../utils";
import { useState } from "react";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import Modal from "../ui/Modal";
import { useTheme } from "../ui/theme";
import RenameTeamSheet from "./RenameTeamSheet";
import ShareSheet from "./ShareSheet";
import type { components } from "../api/schema";
import {
  CheckIcon,
  CrossIcon,
  DoorIcon,
  FlagIcon,
  MailIcon,
  PencilIcon,
  ShareIcon,
  SparkleIcon,
  StarIcon,
  TrophyIcon,
  UpArrowIcon,
} from "../ui/Icon";

type Team = components["schemas"]["Team"];

type Props = {
  team: Team;
  total: number;
  cap: number;
  variant: "joined" | "led";
  onApproveRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
  onCancelRequest?: () => void;
  onLeaveTeam?: () => void;
  onRenameTeam?: (alias: string) => void;
};

export default function TeamCard({
  team,
  total,
  cap,
  variant,
  onApproveRequest,
  onRejectRequest,
  onLeaveTeam,
  onRenameTeam,
}: Props) {
  const { fg, muted } = useTheme();
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
        shareGrad: "linear-gradient(135deg, #6dae4a 0%, #538a37 50%, #6dae4a 100%)",
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
        shareGrad: "linear-gradient(135deg, #e8a900 0%, #c48c00 50%, #e8a900 100%)",
        shareFallback: "rgba(254,210,52,0.12)",
      };
  const [shareOpen, setShareOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const { copied: shareCopied, copy: copyShareClipboard } = useCopyToClipboard();
  const { copied: idCopied, copy: copyIdClipboard } = useCopyToClipboard();
  // Use display_id for shareable team codes (team.id is a UUID that's neither
  // typeable nor memorable).
  const shareCode = team.display_id;
  const shareUrl = "goldenabundance.app";
  const shareMessage = `嗨！我在「金富有」建立了志工團隊，一起來加入吧 ✨\n\n團隊編號：${shareCode}\n開啟 App：${shareUrl}\n\n進入 App 後，點「我的 › 搜尋加入」輸入編號 ${shareCode} 即可申請。`;
  const copyId = () => copyIdClipboard(shareCode);
  const copyShare = () => copyShareClipboard(shareMessage);

  // Full team view (leader OR approved member). Phase 3's "pending join
  // request" state is gone: `myTeams.joined` only returns approved teams;
  // outstanding requests live on the leader's `team.requests` list.
  const complete = total >= cap;
  const memberPoints = (name: string) => 400 + (Math.abs(hashString(name)) % 1200); // 400–1600
  const allMembers = [
    {
      id: team.leader.id,
      name: team.leader.name,
      avatarUrl: team.leader.avatar_url,
      isLeader: true,
    },
    ...(team.members ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      avatarUrl: m.avatar_url,
      isLeader: false,
    })),
  ];

  const requests = team.role === "leader" ? (team.requests ?? []) : [];

  const isLeader = team.role === "leader";
  const teamPoints = total * 180 + 240;
  const teamRank = team.rank ?? 3;
  const weekPoints = Math.round(teamPoints * 0.18);

  return (
    <>
      <div
        style={{
          borderRadius: 24,
          overflow: "hidden",
          background: rc.bg,
          border: rc.border,
          boxShadow:
            "0 8px 24px rgba(80,140,60,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Banner */}
        <div
          style={{
            padding: "18px 18px 16px",
            background: rc.bannerGrad,
            borderBottom: rc.divider,
            position: "relative",
            overflow: "hidden",
          }}
        >
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
                <circle r={r + 0.4} fill={isMemberCard ? "#6dae4a" : "#fec701"} opacity="0.6" />
                <circle r={r * 0.3} fill="#fff" />
              </g>
            ))}
            <path
              d={`M 300 58 L 345 75 L 378 92 L 352 42 L 328 22`}
              stroke={isMemberCard ? "#6dae4a" : "#fec701"}
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
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 9px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.6)",
                  border: rc.borderSoft,
                  fontSize: fs(10),
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  color: rc.primaryDeep,
                  textTransform: "uppercase",
                  marginBottom: 7,
                }}
              >
                {isLeader ? (
                  <>
                    <FlagIcon size={10} /> 組長團隊
                  </>
                ) : (
                  <>
                    <SparkleIcon size={10} /> 組員身份
                  </>
                )}
              </div>
              <div
                style={{
                  fontSize: fs(22),
                  fontWeight: 800,
                  color: fg,
                  lineHeight: 1.15,
                  fontFamily: "var(--font-serif)",
                  letterSpacing: -0.3,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</span>
                {isLeader && onRenameTeam && (
                  <button
                    type="button"
                    aria-label="編輯團隊名稱"
                    onClick={() => setRenameOpen(true)}
                    title={team.alias ? "編輯組名" : "新增組名"}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: rc.borderStrong,
                      background: "rgba(255,255,255,0.85)",
                      color: rc.primary,
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PencilIcon size={12} />
                  </button>
                )}
                {!isLeader && onLeaveTeam && (
                  <button
                    type="button"
                    onClick={() => setLeaveConfirmOpen(true)}
                    title="退出團隊"
                    style={{
                      padding: "4px 11px",
                      borderRadius: 999,
                      border: rc.borderStrong,
                      cursor: "pointer",
                      background: "var(--card)",
                      color: muted,
                      fontSize: fs(12),
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
                    fontSize: fs(12),
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
                background: idCopied ? "rgba(80,200,140,0.18)" : "rgba(255,255,255,0.85)",
                border: idCopied ? "1px solid rgba(80,200,140,0.45)" : rc.borderStrong,
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
                  fontSize: fs(8),
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
                  fontSize: fs(13),
                  fontWeight: 800,
                  color: idCopied ? "#2E9B65" : fg,
                  marginTop: 3,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  letterSpacing: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {shareCode}
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
            type="button"
            onClick={() => setShareOpen(true)}
            style={{
              padding: "16px 18px",
              border: "none",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              background: "linear-gradient(135deg, #fff3c8 0%, #ffe48a 40%, #fec701 100%)",
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
                color: "#8c6d00",
                flexShrink: 0,
                position: "relative",
                zIndex: 1,
                boxShadow: "var(--shadow-1), inset 0 0 0 1.5px rgba(254,199,1,0.4)",
              }}
            >
              <MailIcon size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
              <div
                style={{
                  fontSize: fs(10),
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
                <SparkleIcon size={10} /> 組長專屬任務
              </div>
              <div
                style={{
                  fontWeight: 800,
                  lineHeight: 1.15,
                  fontSize: fs(18),
                  color: "#5a4500",
                  fontFamily: "var(--font-serif)",
                  letterSpacing: -0.3,
                }}
              >
                邀請組員加入
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: fs(11.5),
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
                    fontSize: fs(11),
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
                fontSize: fs(13),
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
              <ShareIcon size={13} />
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
                fontSize: fs(10),
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
                  fontSize: fs(28),
                  fontWeight: 900,
                  lineHeight: 1,
                  color: fg,
                  fontFamily: "var(--font-serif)",
                  letterSpacing: -0.8,
                }}
              >
                <span style={{ color: rc.starIcon, display: "inline-flex" }}>
                  <StarIcon size={22} />
                </span>
                {teamPoints.toLocaleString()}
              </span>
            </div>
            <div
              style={{
                fontSize: fs(11),
                fontWeight: 700,
                color: rc.primary,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <UpArrowIcon size={9} />
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
                fontSize: fs(10),
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
                  fontSize: fs(14),
                  fontWeight: 800,
                  color: muted,
                  lineHeight: 1,
                }}
              >
                #
              </span>
              <span
                style={{
                  fontSize: fs(32),
                  fontWeight: 900,
                  lineHeight: 1,
                  color: rc.primary,
                  fontFamily: "var(--font-serif)",
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
                fontSize: fs(11),
                fontWeight: 700,
                color: muted,
                marginTop: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {teamRank <= 3 ? (
                <>
                  <TrophyIcon size={12} /> 進入前三
                </>
              ) : teamRank <= 10 ? (
                "進入前十"
              ) : (
                "持續努力中"
              )}
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
                fontSize: fs(14),
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
                  fontSize: fs(12),
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
                    background: m.isLeader ? rc.leaderRowBg : "var(--card)",
                    border: m.isLeader ? rc.leaderRowBorder : rc.borderSoft,
                    boxShadow: m.isLeader
                      ? `0 2px 6px ${isMemberCard ? "rgba(109,174,74,0.12)" : "rgba(200,160,0,0.1)"}`
                      : "none",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: fs(10),
                      fontWeight: 800,
                      background:
                        i === 0
                          ? "linear-gradient(135deg, var(--gold-light), var(--gold))"
                          : i === 1
                            ? "rgba(180,190,200,0.5)"
                            : i === 2
                              ? "rgba(210,170,130,0.55)"
                              : "transparent",
                      color: i === 0 ? "#fff" : i <= 2 ? "#fff" : muted,
                      border: i > 2 ? "1px solid rgba(120,90,0,0.2)" : "none",
                      fontFamily: "var(--font-serif)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: avatarBg(m.avatarUrl, m.name),
                      color: "#fff",
                      fontSize: fs(14),
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
                        fontSize: fs(15),
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
                          fontSize: fs(10),
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
                      fontSize: fs(14),
                      fontWeight: 800,
                      color: rc.primary,
                      fontFamily: "var(--font-serif)",
                      letterSpacing: -0.3,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <StarIcon size={11} />
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
              background: "linear-gradient(180deg, rgba(255,214,168,0.1), transparent)",
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
                    border: "1px solid var(--card-strong)",
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
                      background: avatarBg(req.user.avatar_url, req.user.name),
                      color: "#fff",
                      fontSize: fs(12),
                      fontWeight: 700,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {req.user.name[0]}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: fs(13),
                      fontWeight: 700,
                      color: fg,
                    }}
                  >
                    {req.user.name}
                  </div>
                  <button
                    type="button"
                    aria-label="核准"
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
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <CheckIcon size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="拒絕"
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
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <CrossIcon size={13} />
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
                fontSize: fs(11),
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
        />
      )}
      {leaveConfirmOpen && (
        <Modal
          onClose={() => setLeaveConfirmOpen(false)}
          ariaLabel="確認退出團隊"
          zIndex={220}
          style={{
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
              color: "#b03e3e",
            }}
          >
            <DoorIcon size={26} />
          </div>
          <div
            style={{
              fontSize: fs(17),
              fontWeight: 800,
              color: fg,
              textAlign: "center",
              marginBottom: 6,
              fontFamily: "var(--font-serif)",
            }}
          >
            確定要退出團隊？
          </div>
          <div
            style={{
              fontSize: fs(13),
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
              type="button"
              autoFocus
              onClick={() => setLeaveConfirmOpen(false)}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(120,90,0,0.18)",
                background: "transparent",
                color: fg,
                fontSize: fs(14),
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setLeaveConfirmOpen(false);
                onLeaveTeam?.();
              }}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #d66060, #b03e3e)",
                color: "#fff",
                fontSize: fs(14),
                fontWeight: 800,
                fontFamily: "inherit",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(180,60,60,0.35)",
              }}
            >
              確定退出
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
