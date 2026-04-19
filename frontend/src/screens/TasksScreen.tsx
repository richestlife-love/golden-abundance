import { useState, useMemo } from "react";
import BottomNav from "../ui/BottomNav";
import TaskCard from "./TaskCard";
import { getEffectiveStatus } from "../utils";
import { TASKS } from "../data";
import type { Task, ScreenId } from "../types";

type Props = {
  tasks: Task[];
  onNavigate: (screen: ScreenId) => void;
  onOpenTask: (id: number) => void;
};

export default function TasksScreen({ tasks: tasksProp, onNavigate, onOpenTask }: Props) {
  const bg = "#FFFDF5";
  const cardBg = "rgba(255,255,255,0.7)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";
  const muted = "rgba(50,40,0,0.6)";
  const fg = "#241c00";

  const [filter, setFilter] = useState("active");
  const tasks = tasksProp || TASKS;

  const counts = useMemo(() => {
    const c = {
      all: tasks.length,
      active: 0,
      completed: 0,
      expired: 0,
      locked: 0,
    };
    tasks.forEach((t) => {
      const { status } = getEffectiveStatus(t, tasks);
      if (status === "todo" || status === "in_progress" || status === "locked") c.active++;
      if (status === "completed") c.completed++;
      else if (status === "expired") c.expired++;
      else if (status === "locked") c.locked++;
    });
    return c;
  }, [tasks]);

  const filtered = tasks.filter((t) => {
    const { status } = getEffectiveStatus(t, tasks);
    if (filter === "all") return true;
    if (filter === "active")
      return status === "todo" || status === "in_progress" || status === "locked";
    return status === filter;
  });

  const tabs = [
    { key: "active", label: "待完成", n: counts.active },
    { key: "all", label: "全部", n: counts.all },
    { key: "completed", label: "已完成", n: counts.completed },
    { key: "expired", label: "已過期", n: counts.expired },
    { key: "locked", label: "未解鎖", n: counts.locked },
  ];

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
          overflow: "auto",
          padding: "8px 20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animation: "fadeIn 0.4s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: fg,
                letterSpacing: -0.3,
              }}
            >
              任務
            </div>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
              {counts.active} 個進行中 · {counts.completed} 個已完成
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            flexShrink: 0,
            margin: "0 -20px",
            padding: "2px 20px 6px",
            scrollbarWidth: "none",
          }}
        >
          {tabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                style={{
                  flexShrink: 0,
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: active ? "none" : "1px solid rgba(254,210,52,0.35)",
                  background: active ? "linear-gradient(135deg, #fec701, #cb9f01)" : cardBg,
                  color: active ? "#fff" : fg,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {tab.label}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: active ? "rgba(255,255,255,0.25)" : "rgba(120,110,150,0.12)",
                    color: active ? "#fff" : muted,
                  }}
                >
                  {tab.n}
                </span>
              </button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                borderRadius: 16,
                background: cardBg,
                border: cardBorder,
                textAlign: "center",
                color: muted,
                fontSize: 13,
              }}
            >
              此類別暫無任務
            </div>
          ) : filter === "all" ? (
            (() => {
              const bucketOf = (t: Task) => {
                const { status } = getEffectiveStatus(t, tasks);
                if (status === "completed") return "completed";
                if (status === "expired") return "expired";
                return "active"; // todo | in_progress | locked
              };
              const sections = [
                { key: "active", title: "待完成" },
                { key: "completed", title: "已完成" },
                { key: "expired", title: "已過期" },
              ];

              let idx = 0;
              return sections.map((sec, secIdx) => {
                const inSec = filtered.filter((t) => bucketOf(t) === sec.key);
                if (inSec.length === 0) return null;
                return (
                  <div
                    key={sec.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      marginTop: secIdx === 0 ? 0 : 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 10,
                        padding: "0 2px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: fg,
                          letterSpacing: 0.2,
                        }}
                      >
                        {sec.title}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          borderBottom: "1px dashed rgba(254,210,52,0.3)",
                          marginLeft: 4,
                        }}
                      />
                      <div style={{ fontSize: 10, color: muted, fontWeight: 600 }}>
                        {inSec.length}
                      </div>
                    </div>
                    {inSec.map((t) => {
                      const i = idx++;
                      return (
                        <TaskCard
                          key={t.id}
                          t={t}
                          allTasks={tasks}
                          cardBg={cardBg}
                          cardBorder={cardBorder}
                          muted={muted}
                          fg={fg}
                          index={i}
                          onOpen={onOpenTask}
                        />
                      );
                    })}
                  </div>
                );
              });
            })()
          ) : (
            filtered.map((t, i) => (
              <TaskCard
                key={t.id}
                t={t}
                allTasks={tasks}
                cardBg={cardBg}
                cardBorder={cardBorder}
                muted={muted}
                fg={fg}
                index={i}
                onOpen={onOpenTask}
              />
            ))
          )}
        </div>
      </div>

      <BottomNav current="tasks" muted={muted} onNavigate={onNavigate} />
    </div>
  );
}
