import { useState, useMemo } from "react";
import FormShell from "../ui/FormShell";
import FieldLabel from "../ui/FieldLabel";
import SubmitButton from "../ui/SubmitButton";
import { MOCK_TEAMS } from "../data";
import type { Team } from "../types";

type Props = {
  onCancel: () => void;
  onSubmit: (teamData: Omit<Team, "role">) => void;
};

export default function TeamForm({ onCancel, onSubmit }: Props) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

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
      MOCK_TEAMS.filter(
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

  const handleSubmit = () => {
    const t = MOCK_TEAMS.find((x) => x.id === pendingJoin);
    if (!t) return;
    // Populate with a few mock members so the team view feels real
    const mockMemberPool = [
      {
        id: "m-a",
        name: "林詠瑜",
        avatar: "linear-gradient(135deg, #fed234, #fec701)",
      },
      {
        id: "m-b",
        name: "陳志豪",
        avatar: "linear-gradient(135deg, #fec701, #B8A4E3)",
      },
      {
        id: "m-c",
        name: "王美玲",
        avatar: "linear-gradient(135deg, #8AD4B0, #fec701)",
      },
      {
        id: "m-d",
        name: "張書維",
        avatar: "linear-gradient(135deg, #FFC170, #F39770)",
      },
    ];

    const mockMembers = mockMemberPool.slice(0, Math.max(0, (t.members || 1) - 1));
    onSubmit({
      id: t.id,
      status: "pending",
      name: t.name,
      topic: t.topic,
      leader: { id: t.leaderId, name: t.leader, avatar: t.leaderAvatar },
      members: mockMembers,
      currentCount: t.members,
      cap: t.cap,
      points: t.points,
      weekPoints: t.weekPoints,
      rank: t.rank,
    });
  };

  return (
    <FormShell
      bg={bg}
      title="加入團隊"
      subtitle="輸入團隊編號或搜尋名稱，向組長送出申請"
      onCancel={onCancel}
      footer={
        <SubmitButton
          label={valid ? "送出加入申請" : "請先選擇團隊"}
          onClick={handleSubmit}
          disabled={!valid}
          color="#6dae4a"
        />
      }
    >
      <div style={card}>
        <FieldLabel required>團隊編號 / 名稱</FieldLabel>
        <div
          style={{
            fontSize: 11,
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
              fontSize: 14,
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
              fontSize: 13,
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
                fontSize: 12,
                border: "1px dashed rgba(109,174,74,0.35)",
                borderRadius: 12,
                lineHeight: 1.6,
              }}
            >
              找不到符合的團隊
              <br />
              <span style={{ fontSize: 11 }}>請確認團隊編號是否正確</span>
            </div>
          ) : (
            filteredTeams.map((team) => {
              const isPending = pendingJoin === team.id;
              return (
                <div
                  key={team.id}
                  onClick={() => setPendingJoin(isPending ? null : team.id)}
                  style={{
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
                      background: team.leaderAvatar,
                      color: "#fff",
                      fontSize: 16,
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
                      <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>{team.name}</div>
                      <div
                        style={{
                          fontSize: 9,
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
                    <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
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
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {isPending ? "✓ 已選" : "選擇"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </FormShell>
  );
}
