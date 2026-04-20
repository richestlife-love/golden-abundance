import { fs } from "../utils";
import { useState, useMemo } from "react";
import FormShell from "../ui/FormShell";
import FieldLabel from "../ui/FieldLabel";
import SubmitButton from "../ui/SubmitButton";

// Demo-only list of searchable teams. The display_id values here are
// synthetic; when selected, `onSubmit` receives them verbatim so the
// wiring lives upstream. Real teams search (spec §5.3) lands post-Phase 4.
const DEMO_TEAMS = [
  {
    id: "T-MING2024",
    name: "星河守望隊",
    leader: "周明蓁",
    topic: "長者陪伴",
    grad: "linear-gradient(135deg, #fed234, #fec701)",
  },
  {
    id: "T-WEI8810",
    name: "光點行動組",
    leader: "許子瑋",
    topic: "社區導覽",
    grad: "linear-gradient(135deg, #fec701, #B8A4E3)",
  },
  {
    id: "T-TING0517",
    name: "綠意日常",
    leader: "鄭宜庭",
    topic: "環境關懷",
    grad: "linear-gradient(135deg, #8AD4B0, #FFD6A8)",
  },
  {
    id: "T-CHU1109",
    name: "童心共讀",
    leader: "劉雅筑",
    topic: "兒童陪讀",
    grad: "linear-gradient(135deg, #fed234, #FFD6A8)",
  },
];

type Props = {
  onCancel: () => void;
  onSubmit: (teamId: string) => void | Promise<void>;
  isSubmitting?: boolean;
};

export default function TeamForm({ onCancel, onSubmit, isSubmitting = false }: Props) {
  const bg = "var(--bg)";
  const fg = "var(--fg)";
  const muted = "var(--muted)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid var(--card-strong)";

  const [teamQuery, setTeamQuery] = useState("");
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);

  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  const q = teamQuery.trim().toUpperCase();
  const filteredTeams = useMemo(
    () =>
      DEMO_TEAMS.filter(
        (t) =>
          q === "" ||
          t.id.toUpperCase().includes(q) ||
          t.name.includes(teamQuery) ||
          t.leader.includes(teamQuery) ||
          t.topic.includes(teamQuery),
      ),
    [q, teamQuery],
  );

  const valid = pendingJoin != null;

  return (
    <FormShell
      bg={bg}
      title="加入團隊"
      subtitle="輸入團隊編號或搜尋名稱，向組長送出申請"
      onCancel={onCancel}
      footer={
        <SubmitButton
          label={isSubmitting ? "送出中..." : valid ? "送出加入申請" : "請先選擇團隊"}
          onClick={() => {
            if (pendingJoin) void onSubmit(pendingJoin);
          }}
          disabled={!valid || isSubmitting}
          color="#6dae4a"
        />
      }
    >
      <div style={card}>
        <FieldLabel required>團隊編號 / 名稱</FieldLabel>
        <div
          style={{
            fontSize: fs(11),
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          例如：T-MING2024、星河守望隊、周明蓁
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: fs(14),
              color: muted,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            type="text"
            value={teamQuery}
            onChange={(e) => setTeamQuery(e.target.value)}
            placeholder="輸入團隊編號或關鍵字"
            style={{
              width: "100%",
              height: 44,
              padding: "0 14px 0 38px",
              borderRadius: 12,
              border: "1px solid rgba(109,174,74,0.4)",
              background: "rgba(255,255,255,0.9)",
              fontSize: fs(13),
              color: fg,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              letterSpacing: 0.3,
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredTeams.length === 0 ? (
            <div
              style={{
                padding: "24px 12px",
                textAlign: "center",
                color: muted,
                fontSize: fs(12),
                border: "1px dashed rgba(109,174,74,0.35)",
                borderRadius: 12,
                lineHeight: 1.6,
              }}
            >
              找不到符合的團隊
              <br />
              <span style={{ fontSize: fs(11) }}>請確認團隊編號是否正確</span>
            </div>
          ) : (
            filteredTeams.map((team) => {
              const isPending = pendingJoin === team.id;
              return (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={isPending}
                  aria-label={`選擇團隊 ${team.name}`}
                  onClick={() => setPendingJoin(isPending ? null : team.id)}
                  style={{
                    color: "inherit",
                    font: "inherit",
                    textAlign: "left",
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    background: isPending
                      ? "linear-gradient(135deg, rgba(168,214,128,0.3), rgba(109,174,74,0.22))"
                      : "rgba(255,255,255,0.6)",
                    border: isPending
                      ? "1.5px solid rgba(109,174,74,0.65)"
                      : "1px solid rgba(109,174,74,0.25)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: team.grad,
                      color: "#fff",
                      fontSize: fs(16),
                      fontWeight: 700,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {team.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontSize: fs(14), fontWeight: 700, color: fg }}>
                        {team.name}
                      </div>
                      <div
                        style={{
                          fontSize: fs(9),
                          fontWeight: 800,
                          letterSpacing: 0.4,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "rgba(168,214,128,0.35)",
                          color: "#3d7a2e",
                          fontFamily: "monospace",
                        }}
                      >
                        {team.id}
                      </div>
                    </div>
                    <div style={{ fontSize: fs(11), color: muted, marginTop: 3 }}>
                      組長：{team.leader}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: isPending
                        ? "transparent"
                        : "linear-gradient(135deg, #8dc968, #6dae4a)",
                      border: isPending ? "1.5px solid #4e9a2e" : "none",
                      color: isPending ? "#3d7a2e" : "#fff",
                      fontSize: fs(11),
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {isPending ? "✓ 已選" : "選擇"}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </FormShell>
  );
}
