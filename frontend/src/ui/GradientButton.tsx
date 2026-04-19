import { useState } from 'react';

type Props = {
  label: string;
  onClick: () => void;
};

export default function GradientButton({ label, onClick }: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: "100%",
        height: 60,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background:
          "linear-gradient(135deg, #fed234 0%, #fec701 45%, #fec701 100%)",
        color: "#fff",
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 4,
        fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
        boxShadow: pressed
          ? "0 4px 12px rgba(254,199,1,0.4), inset 0 2px 6px rgba(0,0,0,0.1)"
          : "0 12px 30px rgba(254,199,1,0.5), 0 4px 10px rgba(254,210,52,0.35), inset 0 1px 0 rgba(255,255,255,0.5)",
        transition: "all 0.15s ease",
        transform: pressed ? "translateY(1px) scale(0.985)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span style={{ position: "relative", zIndex: 2 }}>{label}</span>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.35), transparent)",
          borderRadius: "999px 999px 0 0",
        }}
      />
    </button>
  );
}
