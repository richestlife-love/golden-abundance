import type { ScreenId } from "../types";

type Props = {
  current: ScreenId;
  muted: string;
  onNavigate: (screen: ScreenId) => void;
};

export default function BottomNav({ current, muted, onNavigate }: Props) {
  const items: { key: ScreenId; label: string; icon: string }[] = [
    { key: "home", label: "首页", icon: "◉" },
    { key: "tasks", label: "任务", icon: "❋" },
    { key: "rank", label: "排行", icon: "▲" },
    { key: "me", label: "我的", icon: "●" },
  ];

  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        justifyContent: "space-around",
        padding: "10px 16px 18px",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(254,210,52,0.25)",
      }}
    >
      {items.map((n) => {
        const active = n.key === current;
        return (
          <div
            key={n.key}
            onClick={() => onNavigate && onNavigate(n.key)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              color: active ? "#fec701" : muted,
            }}
          >
            <div style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</div>
            <div style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{n.label}</div>
          </div>
        );
      })}
    </div>
  );
}
