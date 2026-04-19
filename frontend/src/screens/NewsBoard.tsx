import { useState, useRef, type UIEvent } from 'react';

type Props = {
  fg: string;
  muted: string;
  cardBg: string;
  cardBorder: string;
};

export default function NewsBoard({ fg, muted, cardBg, cardBorder }: Props) {
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
      pinned: false,
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
      pinned: false,
    },
  ];

  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Track scroll snap to keep dots in sync
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
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
        {items.map((n) => (
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
