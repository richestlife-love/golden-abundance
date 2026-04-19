import { useState } from "react";
import type { Team } from "../types";

type Props = {
  team: Team;
  onClose: () => void;
  onSave: (alias: string) => void;
  fg: string;
  muted: string;
};

export default function RenameTeamSheet({ team, onClose, onSave, fg, muted }: Props) {
  const [value, setValue] = useState(team.alias || "");
  const sheetBg = "#FFFFFF";
  const inputBg = "rgba(254,210,52,0.15)";
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(20,10,40,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: sheetBg,
          borderRadius: "22px 22px 0 0",
          padding: "12px 18px 22px",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.25)",
          animation: "slideUp 0.28s ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: 8,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: "rgba(40,30,70,0.2)",
            }}
          />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: fg, marginBottom: 2 }}>
          設定團隊組名
        </div>
        <div
          style={{
            fontSize: 12,
            color: muted,
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          預設名稱「{team.name}」會一同顯示；組名會作為主要名稱呈現。
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 20))}
          placeholder="例如：星光小隊"
          autoFocus
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 12,
            background: inputBg,
            border: "1px solid rgba(254,210,52,0.35)",
            fontSize: 15,
            color: fg,
            fontFamily: "inherit",
            marginBottom: 14,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          {team.alias && (
            <button
              type="button"
              onClick={() => onSave("")}
              style={{
                padding: "11px 14px",
                borderRadius: 12,
                border: "1px solid rgba(254,210,52,0.4)",
                background: "transparent",
                color: muted,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              移除組名
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: team.alias ? "none" : 1,
              padding: "11px 14px",
              borderRadius: 12,
              border: "1px solid rgba(254,210,52,0.4)",
              background: "transparent",
              color: muted,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!value.trim()}
            onClick={() => onSave(value.trim())}
            style={{
              flex: 1,
              padding: "11px 14px",
              borderRadius: 12,
              border: "none",
              background: value.trim()
                ? "linear-gradient(135deg, #fed234, #fec701)"
                : "rgba(254,210,52,0.25)",
              color: value.trim() ? "#fff" : muted,
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: value.trim() ? "pointer" : "not-allowed",
              boxShadow: value.trim() ? "0 4px 12px rgba(254,199,1,0.4)" : "none",
            }}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
