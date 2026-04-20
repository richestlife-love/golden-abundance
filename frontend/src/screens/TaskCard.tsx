import type { components } from "../api/schema";
import { getEffectiveStatus, daysUntil, fs } from "../utils";
import {
  CheckIcon,
  CircleIcon,
  ClockIcon,
  CrossIcon,
  FlowerIcon,
  GiftIcon,
  LockIcon,
  SparkleIcon,
  StarIcon,
} from "../ui/Icon";

type Task = components["schemas"]["Task"];

type Props = {
  t: Task;
  allTasks: Task[];
  cardBg: string;
  cardBorder: string;
  muted: string;
  fg: string;
  index?: number; // default 0
  onOpen: (displayId: string) => void;
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
  const daysLeft = daysUntil(t.due_at);
  const dueDisplay = t.due_at ? t.due_at.slice(0, 10) : null;
  const urgent = status === "todo" && daysLeft != null && daysLeft > 0 && daysLeft <= 7;
  const TagIcon = t.tag === "探索" ? SparkleIcon : t.tag === "社区" ? CircleIcon : FlowerIcon;

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

  const LogoIcon =
    status === "completed"
      ? CheckIcon
      : status === "expired"
        ? CrossIcon
        : status === "locked"
          ? LockIcon
          : TagIcon;
  const logoColor = status === "expired" ? "#8a82a8" : "#fff";

  return (
    <button
      type="button"
      aria-label={`開啟任務 ${t.title}`}
      onClick={() => onOpen(t.display_id)}
      style={{
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        width: "100%",
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
        boxShadow: "var(--shadow-1)",
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
          boxShadow: `0 4px 12px ${t.color}55`,
        }}
      >
        <LogoIcon size={22} />
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <div
            style={{
              fontSize: fs(14),
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
                fontSize: fs(9.5),
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
            <div style={{ fontSize: fs(11), color: muted }}>
              {dueDisplay ? `截止 ${dueDisplay}` : "無截止日"}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: fs(10),
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: 999,
                color: muted,
                background: "rgba(120,110,150,0.08)",
              }}
            >
              <LockIcon size={9} />
              需完成 {unmet.length} 項前置
            </div>
          </div>
        ) : status === "completed" ? (
          <div
            style={{
              fontSize: fs(11),
              color: muted,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <CheckIcon size={11} />
            {dueDisplay ? `已於 ${dueDisplay} 前完成` : "已完成"}
          </div>
        ) : status === "expired" ? (
          <div style={{ fontSize: fs(11), color: muted }}>於 {dueDisplay} 過期</div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: fs(11), color: muted }}>
              {dueDisplay ? `截止 ${dueDisplay}` : "無截止日"}
            </div>
            {dueDisplay && typeof daysLeft === "number" && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: fs(10),
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 999,
                  color: urgent ? "#D9534F" : muted,
                  background: urgent ? "rgba(217,83,79,0.1)" : "transparent",
                }}
              >
                <ClockIcon size={10} />
                {urgent ? `剩 ${daysLeft} 天` : `${daysLeft} 天`}
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
            fontSize: fs(14),
            fontWeight: 800,
            color: status === "completed" ? "#2E9B65" : "#987701",
            whiteSpace: "nowrap",
            letterSpacing: 0.2,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          {status === "completed" && <CheckIcon size={12} />}
          <span>+{t.points}</span>
          <StarIcon size={12} />
        </div>
        {t.bonus && (
          <div
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #F4EBFF, #FFE892)",
              border: "1px solid rgba(184,164,227,0.45)",
              fontSize: fs(10),
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
            <GiftIcon size={10} style={{ flexShrink: 0 }} />
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
    </button>
  );
}
