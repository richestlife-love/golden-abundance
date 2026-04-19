import { fs } from "../utils";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "../state/AppStateContext";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAppState();
  const onBack = () => navigate({ to: "/me" });
  const onEdit = () => navigate({ to: "/me/profile/edit", state: { fromProfile: true } });
  const bg = "var(--bg)";
  const fg = "var(--fg)";
  const muted = "var(--muted)";
  const cardBg = "#FFFBE6";
  const cardBorder = "1px solid rgba(254,199,1,0.22)";
  const accent = "var(--gold-deep)";

  const [idCopied, setIdCopied] = useState(false);
  const copyUserId = async () => {
    if (!user?.id) return;
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1800);
    } catch {
      // permission denied or another failure — skip confirmation
    }
  };

  const COUNTRY_FLAG: Record<string, string> = {
    台灣: "🇹🇼",
    馬來西亞: "🇲🇾",
    新加坡: "🇸🇬",
    中國: "🇨🇳",
    香港: "🇭🇰",
    澳門: "🇲🇴",
    美國: "🇺🇸",
    其他: "🌏",
  };

  const rows = [
    { label: "中文姓名", value: user?.zhName, icon: "文" },
    { label: "英文姓名 English", value: user?.enName, icon: "A" },
    { label: "暱稱 Nickname", value: user?.nickname, icon: "✦" },
    { label: "Email", value: user?.email, icon: "@" },
    {
      label: "聯絡電話",
      value: user?.phone ? `${user.phoneCode || ""} ${user.phone}`.trim() : null,
      icon: "☎",
    },
    { label: "LINE ID", value: user?.lineId, icon: "L" },
    { label: "Telegram ID", value: user?.telegramId, icon: "T" },
    {
      label: "所在國家/地區",
      value: user?.country ? `${COUNTRY_FLAG[user.country] || ""} ${user.country}`.trim() : null,
      icon: "◎",
    },
    { label: "所在城市/地區", value: user?.location, icon: "◉" },
  ];

  const displayName = user?.nickname || user?.zhName || user?.name || "志工";
  const initial = (user?.zhName || user?.name || "U").slice(0, 1).toUpperCase();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "var(--fg)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 8px 6px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          position: "relative",
          zIndex: 2,
        }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: fg,
            fontSize: fs(20),
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: fs(16), fontWeight: 700, color: fg, flex: 1 }}>個人資料</div>
        <button
          type="button"
          onClick={onEdit}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 999,
            border: `1px solid ${accent}60`,
            background: "rgba(254,199,1,0.2)",
            color: accent,
            fontSize: fs(13),
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            marginRight: 8,
          }}
        >
          編輯
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          minHeight: 0,
          padding: "8px 16px 20px",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {/* Hero card */}
        <div
          style={{
            padding: "22px 18px",
            borderRadius: 22,
            background: "linear-gradient(160deg, #FFE48C 0%, #FFEEAD 55%, #FFF7D6 100%)",
            border: "1px solid rgba(254,199,1,0.3)",
            boxShadow: "0 8px 22px rgba(200,160,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: fs(30),
              fontWeight: 800,
              color: "#fff",
              boxShadow: "0 8px 22px rgba(254,199,1,0.4)",
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: fs(20),
                  fontWeight: 800,
                  color: fg,
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </div>
              {user?.id && (
                <button
                  type="button"
                  onClick={copyUserId}
                  title={idCopied ? "已複製" : "點擊複製 ID"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 9px",
                    borderRadius: 8,
                    fontSize: fs(11),
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, "SF Mono", monospace',
                    letterSpacing: 0.3,
                    background: idCopied ? "rgba(80,180,120,0.18)" : "rgba(255,255,255,0.55)",
                    color: idCopied ? "#2d8050" : "rgba(90,70,0,0.85)",
                    border: "1px solid rgba(120,90,0,0.12)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                >
                  {user.id}
                  {idCopied ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            {user?.enName && (
              <div style={{ fontSize: fs(12), color: muted, marginTop: 3 }}>{user.enName}</div>
            )}
          </div>
        </div>

        {/* Field rows */}
        <div
          style={{
            borderRadius: 18,
            background: cardBg,
            border: cardBorder,
            overflow: "hidden",
          }}
        >
          {rows.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 14px",
                borderTop: i === 0 ? "none" : "1px solid rgba(254,199,1,0.12)",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: "rgba(254,199,1,0.18)",
                  color: accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: fs(13),
                  fontWeight: 700,
                }}
              >
                {r.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: fs(11), color: muted, fontWeight: 500 }}>{r.label}</div>
                <div
                  style={{
                    fontSize: fs(14),
                    fontWeight: 600,
                    color: r.value ? fg : muted,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.value || "尚未填寫"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
