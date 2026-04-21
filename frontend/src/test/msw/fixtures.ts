import type { components } from "../../api/schema";

type User = components["schemas"]["User"];
type Team = components["schemas"]["Team"];
type Task = components["schemas"]["Task"];
type Reward = components["schemas"]["Reward"];
type NewsItem = components["schemas"]["NewsItem"];
type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];

export const userJet: User = {
  id: "00000000-0000-0000-0000-000000000001",
  display_id: "UJET",
  email: "jet@demo.ga",
  zh_name: "金杰",
  en_name: "Jet Kan",
  nickname: "Jet",
  name: "金杰",
  phone: "912345678",
  phone_code: "+886",
  line_id: null,
  telegram_id: null,
  country: "TW",
  location: "台北",
  avatar_url: null,
  profile_complete: true,
  created_at: "2026-04-20T00:00:00Z",
};

export const userIncomplete: User = {
  ...userJet,
  id: "00000000-0000-0000-0000-000000000099",
  display_id: "UNEW",
  email: "new@demo.ga",
  zh_name: null,
  name: "new",
  profile_complete: false,
};

export const teamJetLed: Team = {
  id: "00000000-0000-0000-0000-000000000010",
  display_id: "T-JET",
  name: "金杰的團隊",
  alias: null,
  topic: "尚未指定主題",
  leader: {
    id: userJet.id,
    display_id: userJet.display_id,
    name: userJet.name,
    avatar_url: null,
  },
  members: [],
  cap: 6,
  points: 0,
  week_points: 0,
  rank: null,
  role: "leader",
  requests: [],
  created_at: "2026-04-20T00:00:00Z",
};

export const myTeams: MeTeamsResponse = { led: teamJetLed, joined: null };

const taskT1Id = "00000000-0000-0000-0000-000000000101";
const taskT2Id = "00000000-0000-0000-0000-000000000102";
const taskT3Id = "00000000-0000-0000-0000-000000000103";
const taskT4Id = "00000000-0000-0000-0000-000000000104";

export const taskT1: Task = {
  id: taskT1Id,
  display_id: "T1",
  title: "填寫金富有志工表單",
  summary: "完成你的志工個人資料。",
  description: "歡迎加入金富有志工！請填寫基本個人資料。",
  tag: "探索",
  color: "#fec701",
  points: 50,
  bonus: null,
  due_at: null,
  est_minutes: 5,
  is_challenge: false,
  requires: [],
  cap: null,
  form_type: "interest",
  status: "todo",
  progress: 0,
  steps: [],
  team_progress: null,
  created_at: "2026-04-20T00:00:00Z",
};

export const taskT2: Task = {
  id: taskT2Id,
  display_id: "T2",
  title: "夏季盛會報名",
  summary: "為即將到來的夏季盛會報名。",
  description: "夏季盛會將於 5 月 10 日舉行，需要大量志工支援現場。",
  tag: "社区",
  color: "#8AD4B0",
  points: 100,
  bonus: "限定紀念徽章",
  due_at: "2026-04-30T00:00:00Z",
  est_minutes: 10,
  is_challenge: false,
  requires: [],
  cap: null,
  form_type: "ticket",
  status: "in_progress",
  progress: 0.4,
  steps: [],
  team_progress: null,
  created_at: "2026-04-20T00:00:00Z",
};

export const taskT3: Task = {
  id: taskT3Id,
  display_id: "T3",
  title: "組隊挑戰",
  summary: "組建至少 6 人志工團隊。",
  description: "招募夥伴加入你的團隊（你是隊長），或申請加入朋友的團隊。",
  tag: "陪伴",
  color: "#fed234",
  points: 200,
  bonus: "金鑰匙紀念筆",
  due_at: "2026-04-30T00:00:00Z",
  est_minutes: 30,
  is_challenge: true,
  requires: [taskT1Id, taskT2Id],
  cap: 6,
  form_type: null,
  status: "todo",
  progress: 0,
  steps: [],
  team_progress: null,
  created_at: "2026-04-20T00:00:00Z",
};

export const taskT4: Task = {
  id: taskT4Id,
  display_id: "T4",
  title: "春季志工培訓",
  summary: "春季志工基礎培訓。",
  description: "此為每年春季固定舉辦的志工基礎培訓。",
  tag: "探索",
  color: "#B8A4E3",
  points: 30,
  bonus: null,
  due_at: "2026-04-10T00:00:00Z",
  est_minutes: 90,
  is_challenge: false,
  requires: [],
  cap: null,
  form_type: null,
  status: "expired",
  progress: 0,
  steps: [],
  team_progress: null,
  created_at: "2026-04-20T00:00:00Z",
};

export const tasksList: Task[] = [taskT1, taskT2, taskT3, taskT4];

export const rewardsList: Reward[] = [];
export const newsList: NewsItem[] = [];
