import { fs } from "../utils";
import { useState } from "react";
import GoogleLogo from "../ui/GoogleLogo";
import GoogleSpinner from "../ui/GoogleSpinner";

export interface GoogleAuthScreenProps {
  onCancel: () => void;
  onSignIn: () => Promise<void>;
}

export default function GoogleAuthScreen({ onCancel, onSignIn }: GoogleAuthScreenProps) {
  const [pending, setPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const click = async () => {
    setPending(true);
    setError(null);
    try {
      await onSignIn();
      // onSignIn triggers a top-level redirect; if we land here without
      // a redirect, leave `pending` true so the user sees the spinner
      // rather than a re-armed button. A back-navigation resets state.
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗");
      setPending(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        color: "var(--fg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {!pending && (
          <button
            type="button"
            aria-label="關閉"
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              padding: 8,
              margin: -8,
              cursor: "pointer",
              color: "#5F6368",
              fontSize: fs(20),
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 28px",
          gap: 24,
        }}
      >
        <h1
          style={{
            fontFamily: '"Google Sans", "Noto Sans TC", sans-serif',
            fontSize: fs(22),
            fontWeight: 500,
            color: "#202124",
            margin: 0,
            textAlign: "center",
          }}
        >
          使用 Google 帳號登入
        </h1>
        <p
          style={{
            fontSize: fs(13),
            color: "#5F6368",
            margin: 0,
            textAlign: "center",
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          繼續前往 <span style={{ color: "#1A73E8" }}>金富有志工</span>。Google
          會將您的電子郵件地址分享給本應用程式，用以建立您的帳號。
        </p>

        {pending ? (
          <GoogleSpinner />
        ) : (
          <button
            type="button"
            onClick={click}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 24px",
              border: "1px solid #DADCE0",
              borderRadius: 24,
              background: "#fff",
              color: "#3C4043",
              font: "inherit",
              fontWeight: 500,
              fontSize: fs(14),
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F8F9FA")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            <GoogleLogo />
            <span>繼續使用 Google 登入</span>
          </button>
        )}

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #F2B8B5",
              background: "#FCE8E6",
              color: "#C5221F",
              fontSize: fs(13),
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
