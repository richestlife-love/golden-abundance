import { fs } from "../utils";
import type { ReactNode } from "react";
import type { ScreenId } from "../types";

type Props = {
  current: ScreenId;
  muted: string;
  onNavigate: (screen: ScreenId) => void;
};

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HomeIcon = () => (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </svg>
);

const TasksIcon = () => (
  <svg {...iconProps}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4h6v3H9z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const RankIcon = () => (
  <svg {...iconProps}>
    <path d="M7 3h10v4a5 5 0 0 1-10 0V3z" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M10 14h4v4h-4z" />
    <path d="M8 21h8" />
  </svg>
);

const MeIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const ITEMS: { key: ScreenId; label: string; icon: ReactNode }[] = [
  { key: "home", label: "首页", icon: <HomeIcon /> },
  { key: "tasks", label: "任务", icon: <TasksIcon /> },
  { key: "rank", label: "排行", icon: <RankIcon /> },
  { key: "me", label: "我的", icon: <MeIcon /> },
];

export default function BottomNav({ current, muted, onNavigate }: Props) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        justifyContent: "space-around",
        padding: "10px 16px 18px",
        background: "var(--card)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(254,210,52,0.25)",
      }}
    >
      {ITEMS.map((n) => {
        const active = n.key === current;
        return (
          <button
            key={n.key}
            type="button"
            aria-label={n.label}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate && onNavigate(n.key)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              color: active ? "#fec701" : muted,
              border: "none",
              background: "transparent",
              padding: 0,
              font: "inherit",
            }}
          >
            <div style={{ display: "inline-flex", lineHeight: 1 }}>{n.icon}</div>
            <div style={{ fontSize: fs(10), fontWeight: active ? 700 : 500 }}>{n.label}</div>
          </button>
        );
      })}
    </div>
  );
}
