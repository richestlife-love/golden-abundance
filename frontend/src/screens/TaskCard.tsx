import type { Task } from '../types';
import { getEffectiveStatus } from '../utils';

type Props = {
  t: Task;
  allTasks: Task[];
  cardBg: string;
  cardBorder: string;
  muted: string;
  fg: string;
  index?: number;                // default 0
  onOpen: (id: number) => void;
};

export default function TaskCard({
  t,
  allTasks,
  cardBg,
  cardBorder,
  muted,
  fg,
  index = 0,
  onOpen,
}: Props) {
  const { status, unmet } = getEffectiveStatus(t, allTasks);
  const urgent = status === "todo" && t.daysLeft != null && t.daysLeft > 0 && t.daysLeft <= 7;
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
