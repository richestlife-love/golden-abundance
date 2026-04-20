import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useMe } from "../hooks/useMe";
import { useMyTasks } from "../hooks/useMyTasks";
import {
  rankUsersInfiniteQueryOptions,
  rankTeamsInfiniteQueryOptions,
} from "../queries/rank";
import type { RankPeriod } from "../api/rank";
import { avatarBg, fs } from "../utils";
import BottomNav from "../ui/BottomNav";

type Tab = "personal" | "team" | "challenge";

interface RowCommon {
  id: string;
  name: string;
  subtitle: string;
  avatarUrl: string | null | undefined;
  points: number;
  rank: number;
  isMe?: boolean;
  isTeam?: boolean;
}

const PERIODS: Array<{ key: RankPeriod; label: string }> = [
  { key: "week", label: "本週" },
  { key: "month", label: "本月" },
  { key: "all_time", label: "總榜" },
];

export default function RankScreen() {
  const { data: user } = useMe();
  const { data: tasks } = useMyTasks();
  const bg = "var(--bg)";
  const fg = "var(--fg)";
  const muted = "var(--muted)";
  const cardBg = "var(--card)";
  const cardBorder = "1px solid var(--card-strong)";

  const [tab, setTab] = useState<Tab>("personal");
  const [period, setPeriod] = useState<RankPeriod>("month");

  const myPoints = tasks.filter((t) => t.status === "completed").reduce((s, t) => s + t.points, 0);
  const myName = user.nickname || user.zh_name || user.name || "你";

  const usersQ = useInfiniteQuery(rankUsersInfiniteQueryOptions(period));
  const teamsQ = useInfiniteQuery(rankTeamsInfiniteQueryOptions(period));

  const userRows: RowCommon[] =
    usersQ.data?.pages.flatMap((p) =>
      p.items.map((entry) => ({
        id: entry.user.id,
        name: entry.user.name,
        subtitle: entry.user.display_id,
        avatarUrl: entry.user.avatar_url,
        points: entry.points,
        rank: entry.rank,
        isMe: entry.user.id === user.id,
      })),
    ) ?? [];
  const teamRows: RowCommon[] =
    teamsQ.data?.pages.flatMap((p) =>
      p.items.map((entry) => ({
        id: entry.team.id,
        name: entry.team.name,
        subtitle: `隊長 ${entry.team.leader.name}`,
        avatarUrl: entry.team.leader.avatar_url,
        points: entry.points,
        rank: entry.rank,
        isTeam: true,
      })),
    ) ?? [];

  const isChallenge = tab === "challenge";
  const rows = tab === "personal" ? userRows : tab === "team" ? teamRows : [];
  const activeQ = tab === "personal" ? usersQ : tab === "team" ? teamsQ : null;
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const myRank = tab === "personal" ? userRows.find((r) => r.isMe)?.rank ?? null : null;

  // Podium positions: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = top3.length === 3 ? [104, 132, 88] : [132, 104, 88].slice(0, top3.length);
  const medalColors = ["#C9C9D1", "#FEC701", "#C78A5B"]; // silver, gold, bronze
  const rankLabels = ["2", "1", "3"];

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
            background: "radial-gradient(ellipse at 50% 0%, rgba(254,199,1,0.35), transparent 70%)",
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
                fontSize: fs(22),
                fontWeight: 900,
                color: fg,
                letterSpacing: -0.5,
              }}
            >
              排行榜
            </div>
            <div style={{ fontSize: fs(11), color: muted, marginTop: 2 }}>
              {tab === "personal" ? "志工星點排名" : tab === "team" ? "團隊星點排名" : "挑戰任務排名"}
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
              fontSize: fs(11),
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
            { k: "personal" as const, l: "個人" },
            { k: "team" as const, l: "團隊" },
            { k: "challenge" as const, l: "挑戰" },
          ].map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 14,
                fontFamily: "inherit",
                fontSize: fs(14),
                fontWeight: 800,
                cursor: "pointer",
                border: "none",
                background:
                  tab === t.k
                    ? "linear-gradient(135deg, var(--purple), var(--purple-deep))"
                    : "var(--card)",
                color: tab === t.k ? "#fff" : fg,
                boxShadow: tab === t.k ? "0 4px 14px rgba(141,113,199,0.32)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        {/* Period chips (personal/team only) */}
        {!isChallenge && (
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
                type="button"
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  fontSize: fs(12),
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border:
                    period === p.key
                      ? "1px solid rgba(141,113,199,0.6)"
                      : "1px solid rgba(0,0,0,0.08)",
                  background: period === p.key ? "rgba(184,164,227,0.22)" : "transparent",
                  color: period === p.key ? "var(--purple-deep)" : muted,
                }}
              >
                {p.label}
              </button>
            ))}
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
          {isChallenge ? (
            <div
              style={{
                padding: "32px 16px",
                borderRadius: 18,
                background: cardBg,
                border: cardBorder,
                textAlign: "center",
                color: muted,
                fontSize: fs(13),
                lineHeight: 1.6,
              }}
            >
              挑戰任務排名
              <br />
              <span style={{ fontSize: fs(11), opacity: 0.8 }}>即將推出</span>
            </div>
          ) : sorted.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                borderRadius: 18,
                background: cardBg,
                border: cardBorder,
                textAlign: "center",
                color: muted,
                fontSize: fs(13),
              }}
            >
              暫無排名資料
            </div>
          ) : (
            <>
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
                  <svg
                    width="100%"
                    height="100%"
                    style={{ position: "absolute", inset: 0, opacity: 0.3 }}
                  >
                    {Array.from({ length: 14 }).map((_, i) => {
                      const x = (i * 37) % 100,
                        y = (i * 19) % 50,
                        r = ((i % 3) + 1) * 0.8;
                      return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="#fec701" />;
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
                          <div
                            style={{
                              width: isWinner ? 72 : 58,
                              height: isWinner ? 72 : 58,
                              borderRadius: 999,
                              background: avatarBg(p.avatarUrl, p.name),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: fs(isWinner ? 24 : 20),
                              fontWeight: 800,
                              boxShadow: `0 8px 22px ${isWinner ? "rgba(254,199,1,0.5)" : "rgba(0,0,0,0.15)"}`,
                              border: `3px solid ${medal}`,
                              position: "relative",
                            }}
                          >
                            {p.isTeam ? (
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
                            <div
                              style={{
                                position: "absolute",
                                bottom: -6,
                                right: -6,
                                width: 22,
                                height: 22,
                                borderRadius: 999,
                                background: medal,
                                color: "var(--fg)",
                                fontSize: fs(11),
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
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: fs(isWinner ? 14 : 12),
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
                              fontSize: fs(10),
                              color: muted,
                              marginTop: 2,
                              textAlign: "center",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "100%",
                            }}
                          >
                            {p.subtitle}
                          </div>
                          <div
                            style={{
                              marginTop: 6,
                              padding: "3px 10px",
                              borderRadius: 999,
                              background: isWinner
                                ? "linear-gradient(135deg, #FFE29A, #FFC070)"
                                : "rgba(254,199,1,0.18)",
                              color: isWinner ? "#6B4000" : "#987701",
                              fontSize: fs(11),
                              fontWeight: 800,
                              boxShadow: isWinner ? "0 3px 10px rgba(255,180,80,0.3)" : "none",
                            }}
                          >
                            ★ {p.points.toLocaleString()}
                          </div>
                          <div
                            style={{
                              marginTop: 10,
                              width: "100%",
                              height: heights[i],
                              borderRadius: "14px 14px 4px 4px",
                              background: isWinner
                                ? "linear-gradient(180deg, #fed234, #fec701)"
                                : "rgba(255,255,255,0.85)",
                              border: isWinner ? "none" : "1px solid rgba(254,199,1,0.28)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: isWinner ? "var(--fg)" : "var(--gold-dark)",
                              fontSize: fs(28),
                              fontWeight: 900,
                              fontFamily: "var(--font-serif)",
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
                    fontSize: fs(12),
                    fontWeight: 700,
                    color: muted,
                    letterSpacing: 0.5,
                    borderBottom: "1px solid rgba(254,199,1,0.12)",
                  }}
                >
                  {tab === "personal" ? "其他志工" : "其他團隊"}
                </div>
                {rest.length === 0 ? (
                  <div
                    style={{
                      padding: "20px 16px",
                      fontSize: fs(12),
                      color: muted,
                      textAlign: "center",
                    }}
                  >
                    暫無其他排名
                  </div>
                ) : (
                  rest.map((r, i) => (
                    <div
                      key={r.id}
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        borderTop: i === 0 ? "none" : "1px solid rgba(254,199,1,0.12)",
                        background: r.isMe ? "rgba(254,199,1,0.18)" : "transparent",
                        position: "relative",
                      }}
                    >
                      {r.isMe && (
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 6,
                            bottom: 6,
                            width: 3,
                            borderRadius: "0 4px 4px 0",
                            background: "linear-gradient(180deg, #fed234, #fec701)",
                          }}
                        />
                      )}
                      <div
                        style={{
                          width: 26,
                          textAlign: "center",
                          fontSize: fs(14),
                          fontWeight: 800,
                          color: r.isMe ? "#987701" : muted,
                          fontFamily: "var(--font-serif)",
                        }}
                      >
                        {r.rank}
                      </div>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          background: avatarBg(r.avatarUrl, r.name),
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: fs(15),
                          fontWeight: 800,
                          boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                        }}
                      >
                        {r.isTeam ? (
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
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: fs(13),
                            fontWeight: 700,
                            color: fg,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.name}
                          {r.isMe && (
                            <span
                              style={{
                                marginLeft: 6,
                                padding: "1px 6px",
                                borderRadius: 6,
                                fontSize: fs(9),
                                fontWeight: 800,
                                background:
                                  "linear-gradient(135deg, var(--gold-light), var(--gold))",
                                color: "var(--fg)",
                                verticalAlign: "middle",
                              }}
                            >
                              你
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: fs(10),
                            color: muted,
                            marginTop: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.subtitle}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: fs(14),
                          fontWeight: 800,
                          color: r.isMe ? "#987701" : fg,
                          fontFamily: "var(--font-serif)",
                          letterSpacing: -0.3,
                        }}
                      >
                        ★ {r.points.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {activeQ?.hasNextPage && (
                <button
                  type="button"
                  onClick={() => activeQ.fetchNextPage()}
                  disabled={activeQ.isFetchingNextPage}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: "10px",
                    borderRadius: 12,
                    border: "1px solid rgba(141,113,199,0.32)",
                    background: "transparent",
                    color: "var(--purple-deep)",
                    fontSize: fs(12),
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: activeQ.isFetchingNextPage ? "default" : "pointer",
                  }}
                >
                  {activeQ.isFetchingNextPage ? "載入中…" : "載入更多"}
                </button>
              )}
            </>
          )}
        </div>

        {/* Floating "我的排名" pill for personal tab */}
        {tab === "personal" && myRank !== null && myRank > 0 && (
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
              boxShadow: "var(--shadow-2), 0 0 0 1px rgba(254,210,52,0.18)",
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
                fontSize: fs(11),
                fontWeight: 700,
                color: muted,
              }}
            >
              我的
              <br />
              <span
                style={{
                  fontSize: fs(16),
                  fontWeight: 900,
                  color: "#987701",
                  fontFamily: "var(--font-serif)",
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
                background: avatarBg(user.avatar_url, myName),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: fs(14),
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {myName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: fs(13), fontWeight: 700, color: fg }}>{myName}</div>
              <div style={{ fontSize: fs(10), color: muted }}>
                {myRank <= 3
                  ? "太厲害了！你在前三名 🎉"
                  : myRank <= 10
                    ? "加油，即將進入前十！"
                    : "繼續完成任務累積星點"}
              </div>
            </div>
            <div
              style={{
                fontSize: fs(14),
                fontWeight: 800,
                color: "#987701",
                fontFamily: "var(--font-serif)",
              }}
            >
              ★ {myPoints.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <BottomNav muted={muted} />
    </div>
  );
}
