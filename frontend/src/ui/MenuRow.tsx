import type { ReactNode } from 'react';

type Props = {
  icon?: ReactNode;
  label: string;
  trailing?: ReactNode;
  onClick?: () => void;
  fg?: string;
  muted?: string;
  destructive?: boolean;
  divider?: boolean;
};

export default function MenuRow({
  icon,
  label,
  trailing,
  onClick,
  fg,
  muted,
  destructive,
  divider,
}: Props) {
  const color = destructive ? ("#D9534F") : fg;
  const iconBg = destructive
    ? "rgba(217,83,79,0.12)"
    : "rgba(254,210,52,0.2)";
  const iconColor = destructive
    ? "#D9534F"
    : "#987701";
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 16px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        color,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: divider
          ? "1px solid rgba(120,90,0,0.08)"
          : "none",
        transition: "background 0.15s",
      }}
      onMouseOver={(e) =>
      (e.currentTarget.style.background = "rgba(255,255,255,0.45)")
      }
      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: iconBg,
          color: iconColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div
        style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 700 }}
      >
        {label}
      </div>
      {trailing && <div style={{ marginRight: 6 }}>{trailing}</div>}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: muted, flexShrink: 0 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
