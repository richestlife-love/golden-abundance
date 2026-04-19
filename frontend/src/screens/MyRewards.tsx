type Props = {
  fg: string;
  muted: string;
  cardBg: string;
  cardBorder: string;
  totalPoints: number;
  hideHeader?: boolean;
};

export default function MyRewards({
  fg,
  muted,
  cardBg,
  cardBorder,
  totalPoints,
  hideHeader,
}: Props) {
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
  const nextTier = tiers.find((t) => totalPoints < t.required) || tiers[tiers.length - 1];
  const prevRequired =
    tiers.indexOf(nextTier) > 0 ? tiers[tiers.indexOf(nextTier) - 1].required : 0;
  const progressPct = Math.min(
    1,
    Math.max(0, (totalPoints - prevRequired) / Math.max(1, nextTier.required - prevRequired)),
  );
  const reachedMax = totalPoints >= tiers[tiers.length - 1].required;

  const renderIcon = (icon: string, size = 28) => {
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
            return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="#fec701" />;
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
                <div style={{ fontSize: 14, fontWeight: 800, color: fg }}>金牌志工達成 🎉</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>你已解鎖所有階段獎勵</div>
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
                  border: unlocked ? "none" : "1px dashed rgba(152,119,1,0.3)",
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
                  color: unlocked ? "#987701" : muted,
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
        const grouped: Array<{ header?: string; entry?: (typeof history)[0] }> = [];
        let lastDate: string | null = null;
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
                      borderTop: i === 0 ? "none" : "1px solid rgba(254,199,1,0.14)",
                      background: "rgba(254,210,52,0.06)",
                    }}
                  >
                    {g.header}
                  </div>
                );
              }
              const h = g.entry!;
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
                      <span>{h.date.split(" ").slice(1).join(" ") || h.date}</span>
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
