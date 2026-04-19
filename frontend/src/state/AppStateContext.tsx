import { createContext, useContext, useState, type ReactNode } from "react";
import { TASKS } from "../data";
import type { SuccessData, Task, Team, User } from "../types";

type RawUser = Pick<User, "email" | "name" | "avatar">;

export interface AppState {
  user: User | null;
  tasks: Task[];
  ledTeam: Team | null;
  joinedTeam: Team | null;
  successData: SuccessData | null;
  profileComplete: boolean;

  setSuccessData: (d: SuccessData | null) => void;

  handleSignIn: (raw: RawUser) => void;
  handleSignOut: () => void;
  handleProfileComplete: (profile: Partial<User>) => void;
  handleProfileUpdate: (profile: Partial<User>) => void;

  joinTeam: (team: Omit<Team, "role">) => void;
  leaveLedTeam: () => void;
  leaveJoinedTeam: () => void;
  approveRequest: (reqId: string) => void;
  rejectRequest: (reqId: string) => void;
  renameTeam: (alias: string) => void;
  simulateJoinApproved: () => void; // demo-only; remove when Phase 4 wires real events

  completeTask: (id: number) => void;
}

const AppStateCtx = createContext<AppState | null>(null);

function userIdFromEmail(email: string): string {
  return (
    "U" +
    (email || "guest@x.com")
      .split("@")[0]
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6)
      .padEnd(4, "0")
  );
}

export function AppStateProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(() => initialUser ?? null);
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const [ledTeam, setLedTeam] = useState<Team | null>(null);
  const [joinedTeam, setJoinedTeam] = useState<Team | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const profileComplete = !!user?.zhName;

  const syncTeamTask = (led: Team | null, joined: Team | null) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === 3);
      if (idx < 0) return prev;
      const t = prev[idx];
      const cap = t.cap || 6;
      const ledTotal = led ? led.members.length + 1 : 0;
      const joinedTotal =
        joined && joined.status === "approved" ? (joined.currentCount || 0) + 1 : 0;
      const total = Math.max(ledTotal, joinedTotal);
      const complete = total >= cap;
      const updated: Task = {
        ...t,
        status: !led && !joined ? "todo" : complete ? "completed" : "in_progress",
        progress: Math.min(1, total / cap),
        teamProgress: led || joined ? { total, cap, ledTotal, joinedTotal } : null,
      };
      const n = [...prev];
      n[idx] = updated;
      return n;
    });
  };

  const handleSignIn = (raw: RawUser) => {
    const uid = userIdFromEmail(raw.email);
    setUser({ ...raw, id: uid });
  };

  const handleSignOut = () => {
    setUser(null);
    setLedTeam(null);
    setJoinedTeam(null);
  };

  const handleProfileComplete = (profile: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged: User = {
        ...prev,
        name: profile.zhName || prev.name,
        zhName: profile.zhName,
        enName: profile.enName,
        nickname: profile.nickname,
        phone: profile.phone,
        phoneCode: profile.phoneCode,
        lineId: profile.lineId,
        telegramId: profile.telegramId,
        country: profile.country,
        location: profile.location,
      };
      const displayName = merged.name;
      const myTeam: Team = {
        id: "T-" + prev.id.replace(/^U/, ""),
        role: "leader",
        name: `${displayName}的團隊`,
        topic: "尚未指定主題",
        leader: {
          id: prev.id,
          name: displayName,
          avatar: "linear-gradient(135deg, #fed234, #fec701, #fec701)",
        },
        members: [],
        requests: [
          { id: "req1", name: "林詠瑜", avatar: "linear-gradient(135deg, #fed234, #fec701)" },
          { id: "req2", name: "陳志豪", avatar: "linear-gradient(135deg, #fec701, #B8A4E3)" },
          { id: "req3", name: "王美玲", avatar: "linear-gradient(135deg, #8AD4B0, #fec701)" },
        ],
      };
      setLedTeam(myTeam);
      syncTeamTask(myTeam, null);
      return merged;
    });
  };

  const handleProfileUpdate = (profile: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        name: profile.zhName || prev.name,
        zhName: profile.zhName,
        enName: profile.enName,
        nickname: profile.nickname,
        phone: profile.phone,
        phoneCode: profile.phoneCode,
        lineId: profile.lineId,
        telegramId: profile.telegramId,
        country: profile.country,
        location: profile.location,
      };
    });
  };

  const joinTeam = (teamData: Omit<Team, "role">) => {
    const newTeam: Team = { ...teamData, role: "member" };
    setJoinedTeam(newTeam);
    syncTeamTask(ledTeam, newTeam);
    setSuccessData({
      color: "#6dae4a",
      points: 0,
      bonus: `已向「${newTeam.name}」送出申請，等待組長審核`,
      title: "申請已送出！",
    });
  };

  const leaveLedTeam = () => {
    setLedTeam(null);
    syncTeamTask(null, joinedTeam);
  };
  const leaveJoinedTeam = () => {
    setJoinedTeam(null);
    syncTeamTask(ledTeam, null);
  };

  const approveRequest = (reqId: string) => {
    // Functional setState so two rapid approvals both see the latest team.
    let computedUpdate: Team | null = null;
    setLedTeam((prev) => {
      if (!prev) return prev;
      const req = (prev.requests || []).find((r) => r.id === reqId);
      if (!req) return prev;
      const updated: Team = {
        ...prev,
        members: [...prev.members, { id: req.id, name: req.name, avatar: req.avatar }],
        requests: (prev.requests || []).filter((r) => r.id !== reqId),
      };
      computedUpdate = updated;
      return updated;
    });
    if (computedUpdate) {
      const fresh: Team = computedUpdate;
      syncTeamTask(fresh, joinedTeam);
      if (fresh.members.length + 1 >= 6) {
        const t3 = tasks.find((x) => x.id === 3);
        if (t3) {
          setSuccessData({
            color: t3.color,
            points: t3.points,
            bonus: t3.bonus,
            title: "組隊完成！",
          });
        }
      }
    }
  };

  const rejectRequest = (reqId: string) => {
    setLedTeam((prev) =>
      prev ? { ...prev, requests: (prev.requests || []).filter((r) => r.id !== reqId) } : prev,
    );
  };

  const renameTeam = (alias: string) => {
    setLedTeam((prev) => (prev ? { ...prev, alias } : prev));
  };

  const simulateJoinApproved = () => {
    let approved: Team | null = null;
    setJoinedTeam((prev) => {
      if (!prev || prev.status !== "pending") return prev;
      const next: Team = { ...prev, status: "approved" };
      approved = next;
      return next;
    });
    if (approved) syncTeamTask(ledTeam, approved);
  };

  const completeTask = (id: number) => {
    let completed: Task | null = null;
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const t = prev[idx];
      const updated: Task = {
        ...t,
        status: "completed",
        steps: (t.steps || []).map((s) => ({ ...s, done: true })),
        progress: 1,
      };
      completed = updated;
      const n = [...prev];
      n[idx] = updated;
      return n;
    });
    if (completed) {
      const t = completed as Task;
      setSuccessData({ color: t.color, points: t.points, bonus: t.bonus });
    }
  };

  const value: AppState = {
    user,
    tasks,
    ledTeam,
    joinedTeam,
    successData,
    profileComplete,
    setSuccessData,
    handleSignIn,
    handleSignOut,
    handleProfileComplete,
    handleProfileUpdate,
    joinTeam,
    leaveLedTeam,
    leaveJoinedTeam,
    approveRequest,
    rejectRequest,
    renameTeam,
    simulateJoinApproved,
    completeTask,
  };

  return <AppStateCtx.Provider value={value}>{children}</AppStateCtx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
