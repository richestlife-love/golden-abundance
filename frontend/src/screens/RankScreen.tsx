import { useState } from "react";
import BottomNav from "../ui/BottomNav";
import type { User, Task, ScreenId } from "../types";

type Props = {
  user: User | null;
  tasks: Task[];
  onNavigate: (screen: ScreenId) => void;
};

export default function RankScreen({ user, tasks, onNavigate }: Props) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.7)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

  const [tab, setTab] = useState("personal"); // personal | team | challenge
  const [period, setPeriod] = useState("month"); // week | month | all

  const myPoints = (tasks || [])
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.points, 0);
  const myName = user?.nickname || user?.zhName || user?.name || "你";

  // Challenge tasks available for leaderboard
  const challenges = (tasks || []).filter((t) => t.isChallenge);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(
    challenges[0]?.id ?? null,
  );
  const selectedChallenge = challenges.find((c) => c.id === selectedChallengeId) || challenges[0];

  // Mock challenge completion data keyed by task id
  const challengeData: Record<
    number,
    {
      totalTeams: number;
      activeTeams: number;
      totalUsers: number;
      completionRate: number;
      teams: Array<{
        id: string;
        name: string;
        members: number;
        leader: string;
        completedAt: string;
        days: number;
        grad: string;
        isMe?: boolean;
      }>;
    }
  > = {
    3: {
      totalTeams: 42,
      activeTeams: 58,
      totalUsers: 248,
      completionRate: 0.72,
      teams: [
        {
          id: "ct1",
          name: "光明小隊",
          members: 8,
          leader: "張雅婷",
          completedAt: "04/12",
          days: 2,
          grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
        },
        {
          id: "ct2",
          name: "星辰行者",
          members: 6,
          leader: "陳俊宏",
          completedAt: "04/14",
          days: 4,
          grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
        },
        {
          id: "ct3",
          name: "晨光隊",
          members: 7,
          leader: "林佳怡",
          completedAt: "04/15",
          days: 5,
          grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
          isMe: true,
        },
        {
          id: "ct4",
          name: "和風社",
          members: 5,
          leader: "鄭宜庭",
          completedAt: "04/17",
          days: 7,
          grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
        },
        {
          id: "ct5",
          name: "光語隊",
          members: 6,
          leader: "許文斌",
          completedAt: "04/18",
          days: 8,
          grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
        },
        {
          id: "ct6",
          name: "星雨小組",
          members: 4,
          leader: "蔡依倫",
          completedAt: "04/19",
          days: 9,
          grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
        },
        {
          id: "ct7",
          name: "暖陽隊",
          members: 6,
          leader: "李雅雯",
          completedAt: "04/20",
          days: 10,
          grad: "linear-gradient(135deg, #fee99a, #fed234)",
        },
        {
          id: "ct8",
          name: "晨星社",
          members: 5,
          leader: "周明蓁",
          completedAt: "04/21",
          days: 11,
          grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
        },
      ],
    },
  };

  // Mock leaderboard data — per tab × period
  const personal = {
    week: [
      {
        id: "u1",
        name: "張雅婷",
        nick: "Claire",
        points: 420,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "u2",
        name: "陳俊宏",
        nick: "Kevin",
        points: 380,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "u3",
        name: "林佳怡",
        nick: "Jiayi",
        points: 310,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "u4",
        name: "黃詩涵",
        nick: "Shiya",
        points: 260,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
      },
      {
        id: "u5",
        name: "吳宗翰",
        nick: "Zonghan",
        points: 230,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "me",
        name: myName,
        nick: user?.enName || "",
        points: myPoints,
        team: "—",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
        isMe: true,
      },
      {
        id: "u6",
        name: "王美玲",
        nick: "Meiling",
        points: 170,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
      {
        id: "u7",
        name: "劉志豪",
        nick: "Zhihao",
        points: 140,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "u8",
        name: "蔡依倫",
        nick: "Yilun",
        points: 110,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #fee99a, #fed234)",
      },
    ],

    month: [
      {
        id: "u1",
        name: "陳俊宏",
        nick: "Kevin",
        points: 1820,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "u2",
        name: "張雅婷",
        nick: "Claire",
        points: 1640,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "u3",
        name: "黃詩涵",
        nick: "Shiya",
        points: 1380,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
      },
      {
        id: "u4",
        name: "林佳怡",
        nick: "Jiayi",
        points: 1210,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "u5",
        name: "吳宗翰",
        nick: "Zonghan",
        points: 980,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "u6",
        name: "王美玲",
        nick: "Meiling",
        points: 820,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
      {
        id: "u7",
        name: "劉志豪",
        nick: "Zhihao",
        points: 740,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "me",
        name: myName,
        nick: user?.enName || "",
        points: myPoints,
        team: "—",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
        isMe: true,
      },
      {
        id: "u8",
        name: "蔡依倫",
        nick: "Yilun",
        points: 420,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #fee99a, #fed234)",
      },
    ],

    all: [
      {
        id: "u1",
        name: "張雅婷",
        nick: "Claire",
        points: 8240,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "u2",
        name: "陳俊宏",
        nick: "Kevin",
        points: 7980,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "u3",
        name: "黃詩涵",
        nick: "Shiya",
        points: 6510,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
      },
      {
        id: "u4",
        name: "吳宗翰",
        nick: "Zonghan",
        points: 5870,
        team: "星辰行者",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "u5",
        name: "林佳怡",
        nick: "Jiayi",
        points: 5340,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "u6",
        name: "王美玲",
        nick: "Meiling",
        points: 4220,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
      {
        id: "u7",
        name: "劉志豪",
        nick: "Zhihao",
        points: 3780,
        team: "光明小隊",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "u8",
        name: "蔡依倫",
        nick: "Yilun",
        points: 2960,
        team: "晨光隊",
        grad: "linear-gradient(135deg, #fee99a, #fed234)",
      },
      {
        id: "me",
        name: myName,
        nick: user?.enName || "",
        points: myPoints,
        team: "—",
        grad: "linear-gradient(135deg, #fed234, #fec701)",
        isMe: true,
      },
    ],
  };

  const teams = {
    week: [
      {
        id: "t1",
        name: "光明小隊",
        members: 8,
        points: 1420,
        leader: "張雅婷",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "t2",
        name: "星辰行者",
        members: 6,
        points: 1180,
        leader: "陳俊宏",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "t3",
        name: "晨光隊",
        members: 7,
        points: 960,
        leader: "林佳怡",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "t4",
        name: "和風社",
        members: 5,
        points: 720,
        leader: "鄭宜庭",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "t5",
        name: "光語隊",
        members: 6,
        points: 580,
        leader: "許文斌",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
    ],

    month: [
      {
        id: "t1",
        name: "光明小隊",
        members: 8,
        points: 5840,
        leader: "張雅婷",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "t2",
        name: "星辰行者",
        members: 6,
        points: 4620,
        leader: "陳俊宏",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "t3",
        name: "晨光隊",
        members: 7,
        points: 3980,
        leader: "林佳怡",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "t4",
        name: "和風社",
        members: 5,
        points: 2840,
        leader: "鄭宜庭",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "t5",
        name: "光語隊",
        members: 6,
        points: 2160,
        leader: "許文斌",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "t6",
        name: "星雨小組",
        members: 4,
        points: 1420,
        leader: "蔡依倫",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
    ],

    all: [
      {
        id: "t1",
        name: "光明小隊",
        members: 8,
        points: 24620,
        leader: "張雅婷",
        grad: "linear-gradient(135deg, #FFD36E, #FFA43D)",
      },
      {
        id: "t2",
        name: "星辰行者",
        members: 6,
        points: 21840,
        leader: "陳俊宏",
        grad: "linear-gradient(135deg, #B8A4E3, #8D71C7)",
      },
      {
        id: "t3",
        name: "晨光隊",
        members: 7,
        points: 18790,
        leader: "林佳怡",
        grad: "linear-gradient(135deg, #8AD4B0, #4EA886)",
      },
      {
        id: "t4",
        name: "和風社",
        members: 5,
        points: 12640,
        leader: "鄭宜庭",
        grad: "linear-gradient(135deg, #FFC8A4, #F39770)",
      },
      {
        id: "t5",
        name: "光語隊",
        members: 6,
        points: 10260,
        leader: "許文斌",
        grad: "linear-gradient(135deg, #A5C8F7, #6A94CE)",
      },
      {
        id: "t6",
        name: "星雨小組",
        members: 4,
        points: 7480,
        leader: "蔡依倫",
        grad: "linear-gradient(135deg, #F8B2C6, #DA7B99)",
      },
    ],
  };

  const isChallenge = tab === "challenge";
  const currentChallengeData =
    isChallenge && selectedChallenge ? challengeData[selectedChallenge.id] : null;

  const raw = isChallenge
    ? currentChallengeData?.teams || []
    : tab === "personal"
      ? personal[period as keyof typeof personal]
      : teams[period as keyof typeof teams];
  // Sort: challenge = by days (ascending, fastest first); others = by points desc
  const sorted = isChallenge
    ? [...raw].sort((a, b) => (a as { days: number }).days - (b as { days: number }).days)
    : [...raw].sort((a, b) => (b as { points: number }).points - (a as { points: number }).points);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const myRank =
    tab === "personal" ? sorted.findIndex((r) => (r as { isMe?: boolean }).isMe) + 1 : null;

  const PERIODS = [
    { key: "week", label: "本週" },
    { key: "month", label: "本月" },
    { key: "all", label: "總榜" },
  ];

  // Podium positions: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = top3.length === 3 ? [104, 132, 88] : [132, 104, 88].slice(0, top3.length);
  const medalColors = ["#C9C9D1", "#FEC701", "#C78A5B"]; // silver, gold, bronze
  const rankLabels = ["2", "1", "3"];

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
          position: "relative",
        }}
      >
        {/* Decorative glow */}
        <div
          style={{
            position: "absolute",
            inset: "-10% -10% auto -10%",
            height: 260,
            background: "radial-gradient(ellipse at 50% 0%, rgba(254,199,1,0.35), transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 20px 6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: fg,
                letterSpacing: -0.5,
              }}
            >
              排行榜
            </div>
            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
              {tab === "personal"
                ? "志工星點排名"
                : tab === "team"
                  ? "團隊星點排名"
                  : "挑戰任務排名"}
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px 5px 8px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FFE29A, #FFC070)",
              color: "#6B4000",
              fontSize: 11,
              fontWeight: 800,
              boxShadow: "0 3px 10px rgba(255,180,80,0.25)",
            }}
          >
            ★ {myPoints}
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            flexShrink: 0,
            padding: "8px 20px 0",
            display: "flex",
            gap: 8,
            position: "relative",
            zIndex: 2,
          }}
        >
          {[
            { k: "personal", l: "個人" },
            { k: "team", l: "團隊" },
            { k: "challenge", l: "挑戰" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 14,
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                border: "none",
                background:
                  tab === t.k
                    ? "linear-gradient(135deg, #fed234, #fec701)"
                    : "rgba(255,255,255,0.7)",
                color: tab === t.k ? "#241c00" : fg,
                boxShadow: tab === t.k ? "0 4px 14px rgba(254,199,1,0.32)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        {/* Period chips (personal/team) OR challenge selector (challenge) */}
        {!isChallenge ? (
          <div
            style={{
              flexShrink: 0,
              padding: "10px 20px 4px",
              display: "flex",
              gap: 6,
              position: "relative",
              zIndex: 2,
            }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border:
                    period === p.key
                      ? "1px solid rgba(254,199,1,0.7)"
                      : "1px solid rgba(0,0,0,0.08)",
                  background: period === p.key ? "rgba(254,199,1,0.22)" : "transparent",
                  color: period === p.key ? "#987701" : muted,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <div
            style={{
              flexShrink: 0,
              padding: "10px 20px 4px",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              position: "relative",
              zIndex: 2,
            }}
          >
            {challenges.length === 0 ? (
              <div style={{ fontSize: 12, color: muted, padding: "5px 0" }}>暫無挑戰任務</div>
            ) : (
              challenges.map((c) => {
                const active = c.id === selectedChallengeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChallengeId(c.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      border: active
                        ? "1px solid rgba(254,199,1,0.7)"
                        : "1px solid rgba(0,0,0,0.08)",
                      background: active ? "rgba(254,199,1,0.22)" : "transparent",
                      color: active ? "#987701" : muted,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 11 }}>⚑</span>
                    {c.title}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            minHeight: 0,
            padding: "14px 16px 96px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Challenge stats card */}
          {isChallenge && currentChallengeData && (
            <div
              style={{
                marginBottom: 14,
                padding: "14px 16px",
                borderRadius: 18,
                background: "linear-gradient(135deg, #FFF9DC, #FFE892)",
                border: "1px solid rgba(254,199,1,0.35)",
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 4px 12px rgba(254,199,1,0.14)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  flexShrink: 0,
                  background: "linear-gradient(135deg, #fed234, #fec701)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  color: "#fff",
                  boxShadow: "0 4px 10px rgba(254,199,1,0.4)",
                }}
              >
                ⚑
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: fg,
                    fontFamily: '"Noto Serif SC", serif',
                    letterSpacing: 0.3,
                    marginBottom: 4,
                  }}
                >
                  {selectedChallenge?.title}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 11,
                    color: muted,
                    fontWeight: 600,
                  }}
                >
                  <div>
                    <b
                      style={{
                        color: "#987701",
                        fontSize: 13,
                      }}
                    >
                      {currentChallengeData.totalTeams}
                    </b>{" "}
                    個團隊完成
                  </div>
                  <div>
                    <b
                      style={{
                        color: "#987701",
                        fontSize: 13,
                      }}
                    >
                      {currentChallengeData.totalUsers}
                    </b>{" "}
                    位志工參與
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 4,
                    borderRadius: 999,
                    background: "rgba(120,90,0,0.1)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${currentChallengeData.completionRate * 100}%`,
                      background: "linear-gradient(90deg, #fed234, #fec701)",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: muted, marginTop: 3 }}>
                  完成率 {Math.round(currentChallengeData.completionRate * 100)}% (
                  {currentChallengeData.totalTeams}/{currentChallengeData.activeTeams} 報名團隊)
                </div>
              </div>
            </div>
          )}

          {/* Podium */}
          {top3.length === 3 && (
            <div
              style={{
                marginBottom: 18,
                padding: "22px 8px 14px",
                borderRadius: 22,
                position: "relative",
                background:
                  "linear-gradient(180deg, rgba(254,210,52,0.22), rgba(254,233,154,0.05) 70%, transparent)",
                border: "1px solid rgba(254,199,1,0.28)",
                overflow: "hidden",
              }}
            >
              {/* starfield hint */}
              <svg
                width="100%"
                height="100%"
                style={{ position: "absolute", inset: 0, opacity: 0.3 }}
              >
                {Array.from({ length: 14 }).map((_, i) => {
                  const x = (i * 37) % 100,
                    y = (i * 19) % 50,
                    r = ((i % 3) + 1) * 0.8;
                  return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="#fec701" />;
                })}
              </svg>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 14,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {podiumOrder.map((p, i) => {
                  const isWinner = i === 1;
                  const medal = medalColors[i];
                  const rankLbl = rankLabels[i];
                  const entry = p as {
                    id: string;
                    name: string;
                    grad: string;
                    members?: number;
                    leader?: string;
                    completedAt?: string;
                    points?: number;
                    days?: number;
                    team?: string;
                    isMe?: boolean;
                  };
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flex: 1,
                        maxWidth: 112,
                        minWidth: 0,
                        animation: `fadeInUp 0.5s ease ${i * 0.12}s both`,
                      }}
                    >
                      {/* Crown for #1 */}
                      {isWinner && (
                        <svg
                          width="32"
                          height="20"
                          viewBox="0 0 32 20"
                          style={{ marginBottom: -4 }}
                        >
                          <path
                            d="M2 18 L4 6 L10 12 L16 2 L22 12 L28 6 L30 18 Z"
                            fill="#fec701"
                            stroke="#987701"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                          <circle cx="4" cy="6" r="1.8" fill="#fff4cc" />
                          <circle cx="16" cy="2" r="1.8" fill="#fff4cc" />
                          <circle cx="28" cy="6" r="1.8" fill="#fff4cc" />
                        </svg>
                      )}
                      {/* Avatar */}
                      <div
                        style={{
                          width: isWinner ? 72 : 58,
                          height: isWinner ? 72 : 58,
                          borderRadius: 999,
                          background: entry.grad,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: isWinner ? 24 : 20,
                          fontWeight: 800,
                          boxShadow: `0 8px 22px ${isWinner ? "rgba(254,199,1,0.5)" : "rgba(0,0,0,0.15)"}`,
                          border: `3px solid ${medal}`,
                          position: "relative",
                        }}
                      >
                        {tab === "team" || isChallenge ? (
                          <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          >
                            <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                            <circle cx="10" cy="7" r="3.5" />
                            <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M17 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        ) : (
                          entry.name[0]
                        )}
                        {/* Rank badge */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: -6,
                            right: -6,
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: medal,
                            color: "#241c00",
                            fontSize: 11,
                            fontWeight: 900,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px solid #fff9e6",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                          }}
                        >
                          {rankLbl}
                        </div>
                      </div>
                      {/* Name */}
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: isWinner ? 14 : 12,
                          fontWeight: 800,
                          color: fg,
                          textAlign: "center",
                          lineHeight: 1.2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        {entry.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: muted,
                          marginTop: 2,
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        {tab === "team"
                          ? `${entry.members} 人 · ${entry.leader}`
                          : isChallenge
                            ? `${entry.members} 人 · ${entry.completedAt} 完成`
                            : entry.team}
                      </div>
                      {/* Points pill / Days pill */}
                      <div
                        style={{
                          marginTop: 6,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: isWinner
                            ? "linear-gradient(135deg, #FFE29A, #FFC070)"
                            : "rgba(254,199,1,0.18)",
                          color: isWinner ? "#6B4000" : "#987701",
                          fontSize: 11,
                          fontWeight: 800,
                          boxShadow: isWinner ? "0 3px 10px rgba(255,180,80,0.3)" : "none",
                        }}
                      >
                        {isChallenge ? `⏱ ${entry.days} 天` : `★ ${entry.points?.toLocaleString()}`}
                      </div>
                      {/* Plinth */}
                      <div
                        style={{
                          marginTop: 10,
                          width: "100%",
                          height: heights[i],
                          borderRadius: "14px 14px 4px 4px",
                          background: isWinner
                            ? "linear-gradient(180deg, #fed234, #fec701)"
                            : "rgba(255,255,255,0.85)",
                          border: isWinner ? "none" : "1px solid rgba(254,199,1,0.28)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isWinner ? "#241c00" : "#987701",
                          fontSize: 28,
                          fontWeight: 900,
                          fontFamily: '"Noto Serif SC", serif',
                          boxShadow: isWinner
                            ? "inset 0 -10px 20px rgba(152,119,1,0.3), 0 6px 18px rgba(254,199,1,0.35)"
                            : "inset 0 -6px 14px rgba(0,0,0,0.04)",
                          position: "relative",
                        }}
                      >
                        {rankLbl}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ranks 4+ list */}
          <div
            style={{
              borderRadius: 18,
              background: cardBg,
              border: cardBorder,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px 8px",
                fontSize: 12,
                fontWeight: 700,
                color: muted,
                letterSpacing: 0.5,
                borderBottom: "1px solid rgba(254,199,1,0.12)",
              }}
            >
              {tab === "personal" ? "其他志工" : tab === "team" ? "其他團隊" : "其他完成團隊"}
            </div>
            {rest.length === 0 ? (
              <div
                style={{
                  padding: "20px 16px",
                  fontSize: 12,
                  color: muted,
                  textAlign: "center",
                }}
              >
                暫無其他排名
              </div>
            ) : (
              rest.map((r, i) => {
                const actualRank = i + 4;
                const entry = r as {
                  id: string;
                  name: string;
                  grad: string;
                  members?: number;
                  leader?: string;
                  completedAt?: string;
                  points?: number;
                  days?: number;
                  team?: string;
                  isMe?: boolean;
                };
                const isMe = entry.isMe;
                return (
                  <div
                    key={entry.id}
                    style={{
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      borderTop: i === 0 ? "none" : "1px solid rgba(254,199,1,0.12)",
                      background: isMe ? "rgba(254,199,1,0.18)" : "transparent",
                      position: "relative",
                    }}
                  >
                    {isMe && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: 3,
                          borderRadius: "0 4px 4px 0",
                          background: "linear-gradient(180deg, #fed234, #fec701)",
                        }}
                      />
                    )}
                    {/* Rank number */}
                    <div
                      style={{
                        width: 26,
                        textAlign: "center",
                        fontSize: 14,
                        fontWeight: 800,
                        color: isMe ? "#987701" : muted,
                        fontFamily: '"Noto Serif SC", serif',
                      }}
                    >
                      {actualRank}
                    </div>
                    {/* Avatar */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        background: entry.grad,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 800,
                        boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                      }}
                    >
                      {tab === "team" || isChallenge ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                          <circle cx="10" cy="7" r="3.5" />
                          <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M17 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      ) : (
                        entry.name[0]
                      )}
                    </div>
                    {/* Name + subtitle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: fg,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.name}
                        {isMe && (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: "1px 6px",
                              borderRadius: 6,
                              fontSize: 9,
                              fontWeight: 800,
                              background: "linear-gradient(135deg, #fed234, #fec701)",
                              color: "#241c00",
                              verticalAlign: "middle",
                            }}
                          >
                            你
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: muted,
                          marginTop: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tab === "team"
                          ? `${entry.members} 人 · 隊長 ${entry.leader}`
                          : isChallenge
                            ? `${entry.members} 人 · ${entry.completedAt} 完成`
                            : entry.team}
                      </div>
                    </div>
                    {/* Points */}
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: isMe ? "#987701" : fg,
                        fontFamily: '"Noto Serif SC", serif',
                        letterSpacing: -0.3,
                      }}
                    >
                      {isChallenge ? `⏱ ${entry.days} 天` : `★ ${entry.points?.toLocaleString()}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Floating "我的排名" pill for personal tab */}
        {tab === "personal" && myRank !== null && myRank > 0 && (
          <div
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 74,
              padding: "10px 14px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(254,199,1,0.45)",
              boxShadow: "0 10px 28px rgba(100,80,1,0.18), 0 0 0 1px rgba(254,210,52,0.18)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              zIndex: 3,
              animation: "fadeInUp 0.4s ease both",
            }}
          >
            <div
              style={{
                width: 36,
                textAlign: "center",
                fontSize: 11,
                fontWeight: 700,
                color: muted,
              }}
            >
              我的
              <br />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#987701",
                  fontFamily: '"Noto Serif SC", serif',
                }}
              >
                #{myRank}
              </span>
            </div>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "linear-gradient(135deg, #fed234, #fec701)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 14,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {myName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>{myName}</div>
              <div style={{ fontSize: 10, color: muted }}>
                {myRank <= 3
                  ? "太厲害了！你在前三名 🎉"
                  : myRank <= 10
                    ? "加油，即將進入前十！"
                    : "繼續完成任務累積星點"}
              </div>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "#987701",
                fontFamily: '"Noto Serif SC", serif',
              }}
            >
              ★ {myPoints.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <BottomNav current="rank" muted={muted} onNavigate={onNavigate} />
    </div>
  );
}
