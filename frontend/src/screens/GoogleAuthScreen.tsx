import { useState } from 'react';
import PaperBackground from '../ui/PaperBackground';
import GoogleLogo from '../ui/GoogleLogo';
import GoogleSpinner from '../ui/GoogleSpinner';
import type { User } from '../types';

type Props = {
  onCancel: () => void;
  onSuccess: (user: Pick<User, 'email' | 'name' | 'avatar'>) => void;
};

export default function GoogleAuthScreen({ onCancel, onSuccess }: Props) {
  // Stages: 'chooser' -> 'loading' -> success
  const [stage, setStage] = useState("chooser");
  const [selected, setSelected] = useState<Pick<User, 'email' | 'name' | 'avatar'> | null>(null);

  const accounts: Pick<User, 'email' | 'name' | 'avatar'>[] = [
    { name: "陈志明", email: "chen.zhiming@gmail.com", avatar: "#fed234" },
    { name: "林佳怡", email: "lin.jiayi@gmail.com", avatar: "#fec701" },
  ];

  const pickAccount = (a: Pick<User, 'email' | 'name' | 'avatar'>) => {
    setSelected(a);
    setStage("loading");
    setTimeout(() => onSuccess(a), 1800);
  };

  const useAnother = () => {
    setSelected({ name: "你", email: "you@gmail.com", avatar: "#fec701" });
    setStage("loading");
    setTimeout(
      () =>
        onSuccess({ name: "你", email: "you@gmail.com", avatar: "#fec701" }),
      1800,
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        color: "#241c00",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "8px 0 24px",
          overflow: "hidden",
        }}
      >
        {/* Google header */}
        <div
          style={{
            padding: "16px 24px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "fadeIn 0.4s ease",
          }}
        >
          <GoogleLogo />
          {stage === "chooser" && (
            <button
              onClick={onCancel}
              style={{
                background: "none",
                border: "none",
                padding: 8,
                margin: -8,
                cursor: "pointer",
                color: "#5F6368",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {stage === "chooser" && (
          <div
            style={{ padding: "24px 28px 0", animation: "fadeInUp 0.4s ease" }}
          >
            <h1
              style={{
                fontFamily: '"Google Sans", "Noto Sans SC", sans-serif',
                fontSize: 24,
                fontWeight: 400,
                color: "#202124",
                margin: "0 0 6px",
                lineHeight: 1.3,
              }}
            >
              选择账号
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "#5F6368",
                margin: "0 0 4px",
                fontFamily: '"Google Sans", "Noto Sans SC", sans-serif',
              }}
            >
              继续前往 <span style={{ color: "#1A73E8" }}>金富有志工</span>
            </p>
          </div>
        )}

        {stage === "chooser" && (
          <div
            style={{
              margin: "28px 16px 0",
              borderRadius: 8,
              border: "1px solid #DADCE0",
              overflow: "hidden",
              animation: "fadeInUp 0.5s 0.1s ease backwards",
            }}
          >
            {accounts.map((a) => (
              <div
                key={a.email}
                onClick={() => pickAccount(a)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid #DADCE0",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#F8F9FA")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${a.avatar}, ${a.avatar}DD)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {a.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ fontSize: 14, color: "#202124", fontWeight: 500 }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#5F6368",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.email}
                  </div>
                </div>
              </div>
            ))}
            <div
              onClick={useAnother}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#F8F9FA")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid #DADCE0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#5F6368",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="#5F6368"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div style={{ fontSize: 14, color: "#202124" }}>使用其他账号</div>
            </div>
          </div>
        )}

        {stage === "chooser" && (
          <div
            style={{
              padding: "20px 28px 0",
              fontSize: 12,
              color: "#5F6368",
              lineHeight: 1.5,
              animation: "fadeIn 0.6s 0.2s ease backwards",
            }}
          >
            如要继续，Google
            会将您的姓名、邮箱地址、语言偏好设置和个人资料照片分享给"金富有志工"。使用此应用前，请查看"金富有志工"的
            <span style={{ color: "#1A73E8" }}> 隐私权政策</span> 和
            <span style={{ color: "#1A73E8" }}> 服务条款</span>。
          </div>
        )}

        {stage === "loading" && selected && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 32px",
              gap: 20,
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${selected.avatar}, ${selected.avatar}DD)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {selected.name[0]}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#5F6368", marginBottom: 4 }}>
                正在登录…
              </div>
              <div style={{ fontSize: 13, color: "#202124" }}>
                {selected.email}
              </div>
            </div>
            <GoogleSpinner />
          </div>
        )}
      </div>
    </div>
  );
}
