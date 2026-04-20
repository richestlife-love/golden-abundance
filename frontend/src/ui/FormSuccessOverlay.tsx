import { fs } from "../utils";
import { useEffect } from "react";
import type { SuccessData } from "./UIStateProvider";

type Props = SuccessData & { onDone: () => void };

export default function FormSuccessOverlay({
  color,
  points,
  bonus,
  title = "任務完成！",
  onDone,
}: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(20,15,40,0.75)",
        backdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "32px 40px",
          animation: "fadeInUp 0.5s ease",
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${color}, ${color}C0)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fs(54),
            color: "#fff",
            margin: "0 auto 18px",
            boxShadow: `0 12px 36px ${color}60`,
            animation: "fadeInUp 0.5s 0.1s ease backwards",
          }}
        >
          ✓
        </div>
        <div
          style={{
            fontSize: fs(24),
            fontWeight: 800,
            color: "#fff",
            letterSpacing: 0.3,
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        {points > 0 && (
          <div
            style={{
              fontSize: fs(15),
              fontWeight: 700,
              color: "#fedd67",
              marginBottom: 4,
            }}
          >
            ＋{points} 星點
          </div>
        )}
        {bonus && (
          <div
            style={{
              fontSize: fs(13),
              color: "#FFE8B8",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              textAlign: "center",
              maxWidth: 260,
            }}
          >
            <span>🎁</span> {bonus}
          </div>
        )}
      </div>
    </div>
  );
}
