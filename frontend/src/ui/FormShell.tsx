import type { ReactNode } from "react";

type Props = {
  bg: string;
  title: string;
  subtitle?: string;
  onCancel: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function FormShell({ bg, title, subtitle, onCancel, children, footer }: Props) {
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
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
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px 6px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 8,
              borderRadius: 10,
              color: fg,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            取消
          </button>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: fg,
              textAlign: "center",
              flex: 1,
            }}
          >
            {title}
          </div>
          <div style={{ width: 72 }} />
        </div>

        {subtitle && (
          <div
            style={{
              padding: "0 20px 4px",
              fontSize: 12,
              color: muted,
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            minHeight: 0,
            padding: "16px 16px 20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
        </div>

        {/* Sticky footer */}
        {footer && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              padding: "12px 16px 16px",
              background: "linear-gradient(180deg, transparent, rgba(255,250,255,0.92) 40%)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
