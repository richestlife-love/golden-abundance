import type { components } from "../../api/schema";

type User = components["schemas"]["User"];
type Team = components["schemas"]["Team"];
type Task = components["schemas"]["Task"];
type Reward = components["schemas"]["Reward"];
type NewsItem = components["schemas"]["NewsItem"];
type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];
type AuthResponse = components["schemas"]["AuthResponse"];

export const userJet: User = {
  id: "00000000-0000-0000-0000-000000000001",
  display_id: "UJET",
  email: "jet@demo.gal",
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
  email: "new@demo.gal",
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

export const tasksList: Task[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
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
  },
];

export const rewardsList: Reward[] = [];
export const newsList: NewsItem[] = [];

export const authResponseJet: AuthResponse = {
  access_token: "test-token-jet",
  token_type: "bearer",
  expires_in: 86400,
  user: userJet,
  profile_complete: true,
};
