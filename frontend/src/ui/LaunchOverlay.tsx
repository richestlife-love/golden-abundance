import { useEffect } from 'react';

type Props = {
  onDone: () => void;
};

export default function LaunchOverlay({ onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        background:
          "radial-gradient(circle at 50% 50%, rgba(255,249,230,0.97) 0%, rgba(254,221,103,0.97) 50%, rgba(254,210,52,0.97) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 24,
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          border: "4px solid rgba(254,199,1,0.2)",
          borderTopColor: "#fec701",
          animation: "spin 1s linear infinite",
        }}
      />
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 6,
          fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
          color: "#987701",
        }}
      >
        启航中…
      </div>
    </div>
  );
}
