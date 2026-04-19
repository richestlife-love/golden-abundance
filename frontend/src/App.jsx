// React app page — 金富有志工
// Full-viewport mobile-app landing. No device frame. Responsive, CTA always visible.

import { useState, useEffect, useMemo } from 'react';
import { TASKS, MOCK_TEAMS } from './data';
import { getEffectiveStatus } from './utils';
import GlobalStyles from './ui/GlobalStyles';
import BottomNav from './ui/BottomNav';
import FormShell from './ui/FormShell';
import FieldLabel from './ui/FieldLabel';
import TextInput from './ui/TextInput';
import Textarea from './ui/Textarea';
import ChipGroup from './ui/ChipGroup';
import SubmitButton from './ui/SubmitButton';
import FormSuccessOverlay from './ui/FormSuccessOverlay';
import LandingScreen from './screens/LandingScreen';
import GoogleAuthScreen from './screens/GoogleAuthScreen';
import HomeScreen from './screens/HomeScreen';
import TasksScreen from './screens/TasksScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';
import RankScreen from './screens/RankScreen';
import RewardsScreen from './screens/RewardsScreen';
import MyScreen from './screens/MyScreen';

// ─── Tasks Screen → frontend/src/screens/TasksScreen.tsx ──────
// ─── Task Detail Screen → frontend/src/screens/TaskDetailScreen.tsx ──
// ─── Rank Screen → frontend/src/screens/RankScreen.tsx ──────────
// ─── Rewards Screen → frontend/src/screens/RewardsScreen.tsx ────

// ─── Task Form Screens ───────────────────────────────────────
// Onboarding — profile setup for new users (after Google sign-in)
function ProfileScreen({ user, onBack, onEdit }) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "#FFFBE6";
  const cardBorder = "1px solid rgba(254,199,1,0.22)";
  const accent = "#cb9f01";

  const [idCopied, setIdCopied] = useState(false);
  const copyUserId = () => {
    if (!user?.id) return;
    try {
      navigator.clipboard && navigator.clipboard.writeText(user.id);
    } catch (err) { }
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 1800);
  };

  const COUNTRY_FLAG = {
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
      value: user?.phone
        ? `${user.phoneCode || ""} ${user.phone}`.trim()
        : null,
      icon: "☎",
    },
    { label: "LINE ID", value: user?.lineId, icon: "L" },
    { label: "Telegram ID", value: user?.telegramId, icon: "T" },
    {
      label: "所在國家/地區",
      value: user?.country
        ? `${COUNTRY_FLAG[user.country] || ""} ${user.country}`.trim()
        : null,
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
        color: "#241c00",
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
            fontSize: 20,
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: fg, flex: 1 }}>
          個人資料
        </div>
        <button
          onClick={onEdit}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 999,
            border: `1px solid ${accent}60`,
            background: "rgba(254,199,1,0.2)",
            color: accent,
            fontSize: 13,
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
              background: "linear-gradient(135deg, #fed234, #fec701)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
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
                  fontSize: 20,
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
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, "SF Mono", monospace',
                    letterSpacing: 0.3,
                    background: idCopied
                      ? "rgba(80,180,120,0.18)"
                      : "rgba(255,255,255,0.55)",
                    color: idCopied
                      ? "#2d8050"
                      : "rgba(90,70,0,0.85)",
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
              <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
                {user.enName}
              </div>
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
                borderTop:
                  i === 0
                    ? "none"
                    : "1px solid rgba(254,199,1,0.12)",
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
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {r.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: muted, fontWeight: 500 }}>
                  {r.label}
                </div>
                <div
                  style={{
                    fontSize: 14,
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

// Onboarding — profile setup for new users (after Google sign-in)
function ProfileSetupForm({
  user,
  initial,
  onCancel,
  onSubmit,
  title = "完善個人資料",
  subtitle = "初次加入，請填寫基本資訊，稍後可於「我的」中修改",
  submitLabel = "完成註冊",
}) {
  const bg = "#FFFDF5";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";
  const fg = "#241c00";

  const initEn =
    initial?.enName ||
    ((user?.name || "").match(/[A-Za-z\s]/) ? user.name : "");
  const initZh =
    initial?.zhName ||
    ((user?.name || "").match(/[\u4e00-\u9fa5]/) ? user.name : "");
  const [zhName, setZhName] = useState(initZh);
  const [enName, setEnName] = useState(initEn);
  const [nickname, setNickname] = useState(initial?.nickname || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [phoneCode, setPhoneCode] = useState(initial?.phoneCode || "+886");
  const [lineId, setLineId] = useState(initial?.lineId || "");
  const [telegramId, setTelegramId] = useState(initial?.telegramId || "");
  const [country, setCountry] = useState(initial?.country || "");
  const [location, setLocation] = useState(initial?.location || "");

  // Country → regions map
  const REGIONS = {
    台灣: [
      "台北",
      "新北",
      "基隆",
      "桃園",
      "新竹",
      "苗栗",
      "台中",
      "彰化",
      "南投",
      "雲林",
      "嘉義",
      "台南",
      "高雄",
      "屏東",
      "宜蘭",
      "花蓮",
      "台東",
      "澎湖",
      "金門",
      "馬祖",
    ],
    馬來西亞: [
      "吉隆坡",
      "雪蘭莪",
      "檳城",
      "柔佛",
      "霹靂",
      "森美蘭",
      "馬六甲",
      "吉打",
      "登嘉樓",
      "彭亨",
      "吉蘭丹",
      "沙巴",
      "砂拉越",
      "玻璃市",
      "納閩",
      "布城",
    ],
    新加坡: ["中區", "東區", "北區", "東北區", "西區"],
    中國: [
      "北京",
      "上海",
      "廣州",
      "深圳",
      "成都",
      "杭州",
      "南京",
      "武漢",
      "西安",
      "廈門",
      "福州",
      "青島",
      "其他城市",
    ],
    香港: ["港島", "九龍", "新界"],
    澳門: ["澳門半島", "氹仔", "路環"],
    美國: [
      "加州",
      "紐約",
      "德州",
      "華盛頓州",
      "伊利諾州",
      "麻州",
      "新澤西州",
      "佛羅里達州",
      "夏威夷",
      "其他州",
    ],
    其他: [],
  };
  const COUNTRY_DIAL = {
    台灣: "+886",
    馬來西亞: "+60",
    新加坡: "+65",
    中國: "+86",
    香港: "+852",
    澳門: "+853",
    美國: "+1",
    其他: "",
  };
  const DIAL_OPTIONS = [
    { code: "+886", label: "🇹🇼 +886" },
    { code: "+60", label: "🇲🇾 +60" },
    { code: "+65", label: "🇸🇬 +65" },
    { code: "+86", label: "🇨🇳 +86" },
    { code: "+852", label: "🇭🇰 +852" },
    { code: "+853", label: "🇲🇴 +853" },
    { code: "+1", label: "🇺🇸 +1" },
    { code: "+81", label: "🇯🇵 +81" },
    { code: "+82", label: "🇰🇷 +82" },
    { code: "+44", label: "🇬🇧 +44" },
    { code: "+61", label: "🇦🇺 +61" },
    { code: "+64", label: "🇳🇿 +64" },
    { code: "+66", label: "🇹🇭 +66" },
    { code: "+84", label: "🇻🇳 +84" },
    { code: "+62", label: "🇮🇩 +62" },
    { code: "+63", label: "🇵🇭 +63" },
    { code: "+91", label: "🇮🇳 +91" },
    { code: "+49", label: "🇩🇪 +49" },
    { code: "+33", label: "🇫🇷 +33" },
  ];

  const COUNTRIES = Object.keys(REGIONS);
  const regions = country ? REGIONS[country] : [];

  // Reset location when country changes
  const handleCountry = (v) => {
    setCountry(v);
    setLocation("");
    if (COUNTRY_DIAL[v]) setPhoneCode(COUNTRY_DIAL[v]);
  };

  const valid =
    zhName.trim() &&
    phone.trim() &&
    country &&
    (typeof location === "string" ? location.trim() : location);
  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  return (
    <FormShell
      bg={bg}
      title={title}
      subtitle={subtitle}
      onCancel={onCancel}
      footer={
        <SubmitButton
          label={submitLabel}
          onClick={() =>
            onSubmit({
              zhName: zhName.trim(),
              enName: enName.trim(),
              nickname: nickname.trim(),
              phone: phone.trim(),
              phoneCode: phoneCode,
              lineId: lineId.trim(),
              telegramId: telegramId.trim(),
              country: country,
              location: location,
            })
          }
          disabled={!valid}
          color="#fec701"
        />
      }
    >
      {/* Welcome card with avatar */}
      <div
        style={{
          padding: "16px 14px",
          borderRadius: 16,
          background: "rgba(254,199,1,0.18)",
          border: "1px solid rgba(254,199,1,0.35)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #fed234, #fec701)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(254,199,1,0.35)",
          }}
        >
          {(user?.name || "U").slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>
            {user?.name || "新志工"}
          </div>
          <div
            style={{
              fontSize: 11,
              color: muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.email}
          </div>
        </div>
      </div>

      <div style={card}>
        <FieldLabel required>
          中文姓名
        </FieldLabel>
        <TextInput
          value={zhName}
          onChange={setZhName}
          placeholder="請輸入你的中文姓名"
        />
      </div>

      <div style={card}>
        <FieldLabel>英文姓名</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          如證件上之拼音 As per NRIC（選填）
        </div>
        <TextInput
          value={enName}
          onChange={setEnName}
          placeholder="e.g. Chia-Yi Lin"
        />
      </div>

      <div style={card}>
        <FieldLabel>暱稱 Nickname</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          朋友們會這樣稱呼你（選填）
        </div>
        <TextInput
          value={nickname}
          onChange={setNickname}
          placeholder="e.g. 小佳 / Alice Ng"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          聯絡電話
        </FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              style={{
                height: 46,
                padding: "0 28px 0 12px",
                borderRadius: 12,
                border: "1px solid rgba(254, 210, 52, 0.4)",
                background: "rgba(255,255,255,0.85)",
                fontSize: 14,
                color: "#241c00",
                fontFamily: "inherit",
                outline: "none",
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
              }}
            >
              {DIAL_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                fontSize: 10,
                color: "rgba(50,40,0,0.6)",
              }}
            >
              ▾
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextInput
              value={phone}
              onChange={setPhone}
              placeholder="912-345-678"
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <FieldLabel>LINE ID</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          方便活動聯繫（選填）
        </div>
        <TextInput
          value={lineId}
          onChange={setLineId}
          placeholder="@your-line-id"
        />
      </div>

      <div style={card}>
        <FieldLabel>Telegram ID</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          方便活動聯繫（選填）
        </div>
        <TextInput
          value={telegramId}
          onChange={setTelegramId}
          placeholder="@your-telegram-id"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          所在國家/地區
        </FieldLabel>
        <ChipGroup
          options={COUNTRIES}
          value={country}
          onChange={handleCountry}
          multi={false}
        />
      </div>

      {country && (
        <div style={card}>
          <FieldLabel required>
            所在城市/地區
          </FieldLabel>
          <div
            style={{
              fontSize: 11,
              color: muted,
              marginBottom: 10,
              marginTop: -4,
            }}
          >
            {country === "其他" ? "請輸入你的國家與城市" : "請選擇主要活動地區"}
          </div>
          {country === "其他" ? (
            <TextInput
              value={location}
              onChange={setLocation}
              placeholder="e.g. Canada, Vancouver"
            />
          ) : (
            <ChipGroup
              options={regions}
              value={location}
              onChange={setLocation}
              multi={false}
            />
          )}
        </div>
      )}
    </FormShell>
  );
}

// Task 1 — Interest & skills form
function InterestForm({ onCancel, onSubmit }) {
  const bg = "#FFFDF5";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [interests, setInterests] = useState([]);
  const [skills, setSkills] = useState([]);
  const [availability, setAvailability] = useState([]);

  const valid =
    name.trim() &&
    phone.trim() &&
    interests.length > 0 &&
    availability.length > 0;
  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  return (
    <FormShell
      bg={bg}
      title="填寫志工表單"
      subtitle="填寫個人資訊、興趣與可投入時段"
      onCancel={onCancel}
      footer={
        <SubmitButton
          label="提交表單"
          onClick={onSubmit}
          disabled={!valid}
          color="#fec701"
        />
      }
    >
      <div style={card}>
        <FieldLabel required>
          姓名
        </FieldLabel>
        <TextInput
          value={name}
          onChange={setName}
          placeholder="請輸入你的姓名"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          聯絡電話
        </FieldLabel>
        <TextInput
          value={phone}
          onChange={setPhone}
          placeholder="09xx-xxxxxx"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          興趣方向
        </FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          可複選
        </div>
        <ChipGroup
          options={[
            "活動策劃",
            "接待導覽",
            "文宣設計",
            "攝影紀錄",
            "物資管理",
            "陪伴關懷",
            "翻譯協助",
            "其他",
          ]}
          value={interests}
          onChange={setInterests}
          multi
        />
      </div>

      <div style={card}>
        <FieldLabel>專長技能</FieldLabel>
        <div
          style={{
            fontSize: 11,
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          可複選，協助我們配對合適的任務
        </div>
        <ChipGroup
          options={[
            "領導統籌",
            "設計美編",
            "活動企劃",
            "影像剪輯",
            "外語",
            "文案寫作",
            "資料分析",
            "樂器演奏",
          ]}
          value={skills}
          onChange={setSkills}
          multi
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          可投入時段
        </FieldLabel>
        <ChipGroup
          options={["平日白天", "平日晚上", "週末白天", "週末晚上"]}
          value={availability}
          onChange={setAvailability}
          multi
        />
      </div>
    </FormShell>
  );
}

// Task 2 — Ticket form
function TicketForm({ onCancel, onSubmit }) {
  const bg = "#FFFDF5";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";
  const muted = "rgba(50,40,0,0.6)";

  const [name, setName] = useState("");
  const [ticket725, setTicket725] = useState("");
  const [ticket726, setTicket726] = useState("");
  const [note, setNote] = useState("");

  const valid = name.trim() && ticket725.trim() && ticket726.trim();
  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  return (
    <FormShell
      bg={bg}
      title="夏季盛會報名"
      subtitle="請輸入 7/25 與 7/26 場次票券編號"
      onCancel={onCancel}
      footer={
        <SubmitButton
          label="提交報名"
          onClick={onSubmit}
          disabled={!valid}
          color="#8AD4B0"
        />
      }
    >
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 16,
          background:
            "linear-gradient(135deg, rgba(138,212,176,0.18), rgba(138,212,176,0.08))",
          border: `1px solid ${"rgba(138,212,176,0.4)"}`,
          fontSize: 12,
          color: "#2E7B5A",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>📅 夏季盛會資訊</div>
        7 月 25 日（六）·活動一日場
        <br />7 月 26 日（日）·活動二日場
      </div>

      <div style={card}>
        <FieldLabel required>
          姓名
        </FieldLabel>
        <TextInput
          value={name}
          onChange={setName}
          placeholder="請輸入你的姓名"
        />
      </div>

      <div style={card}>
        <FieldLabel required>
          7/25 票券編號
        </FieldLabel>
        <TextInput
          value={ticket725}
          onChange={setTicket725}
          placeholder="例如：RL-0725-8420"
        />
        <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
          可於購票 Email 或錢包中找到 12 位編號
        </div>
      </div>

      <div style={card}>
        <FieldLabel required>
          7/26 票券編號
        </FieldLabel>
        <TextInput
          value={ticket726}
          onChange={setTicket726}
          placeholder="例如：RL-0726-1173"
        />
      </div>

      <div style={card}>
        <FieldLabel>備註</FieldLabel>
        <Textarea
          value={note}
          onChange={setNote}
          placeholder="飲食需求、交通協助等（可留白）"
        />
      </div>
    </FormShell>
  );
}

// Task 3 — Join a team (search by team ID, name, or leader)
function TeamForm({ onCancel, onSubmit }) {
  const bg = "#FFFDF5";
  const fg = "#241c00";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

  const [teamQuery, setTeamQuery] = useState("");
  const [pendingJoin, setPendingJoin] = useState(null);

  const card = {
    padding: "14px 14px",
    borderRadius: 16,
    background: cardBg,
    border: cardBorder,
    backdropFilter: "blur(10px)",
  };

  const q = teamQuery.trim().toUpperCase();
  const filteredTeams = MOCK_TEAMS.filter(
    (t) =>
      q === "" ||
      t.id.toUpperCase().includes(q) ||
      t.name.includes(teamQuery) ||
      t.leader.includes(teamQuery) ||
      t.topic.includes(teamQuery),
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

    const mockMembers = mockMemberPool.slice(
      0,
      Math.max(0, (t.members || 1) - 1),
    );
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
        <FieldLabel required>
          團隊編號 / 名稱
        </FieldLabel>
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
                      <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>
                        {team.name}
                      </div>
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

// Success overlay after submission
// ─── App ──────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState("landing");
  const [rewardsFrom, setRewardsFrom] = useState("home");
  const navigateTo = (next) => {
    if (next === "rewards") setRewardsFrom(screen === "me" ? "me" : "home");
    setScreen(next);
  };
  const [user, setUser] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [tasks, setTasks] = useState(TASKS);
  const [successData, setSuccessData] = useState(null);
  const [ledTeam, setLedTeam] = useState(null);
  const [joinedTeam, setJoinedTeam] = useState(null);

  const openTask = (id) => {
    setCurrentTaskId(id);
    setScreen("taskDetail");
  };
  const openTaskForm = (id) => {
    setCurrentTaskId(id);
    setScreen("form");
  };

  const userIdFromEmail = (email) =>
    "U" +
    (email || "guest@x.com")
      .split("@")[0]
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6)
      .padEnd(4, "0");

  const handleSignIn = (rawUser) => {
    const uid = userIdFromEmail(rawUser.email);
    const fullUser = { ...rawUser, id: uid };
    setUser(fullUser);
    // Route new users to profile setup first
    setScreen("profileSetup");
  };

  const handleProfileComplete = (profile) => {
    setUser((prev) => {
      const merged = {
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
      // Auto-create the user's own team
      const myTeam = {
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
          {
            id: "req1",
            name: "林詠瑜",
            avatar: "linear-gradient(135deg, #fed234, #fec701)",
          },
          {
            id: "req2",
            name: "陳志豪",
            avatar: "linear-gradient(135deg, #fec701, #B8A4E3)",
          },
          {
            id: "req3",
            name: "王美玲",
            avatar: "linear-gradient(135deg, #8AD4B0, #fec701)",
          },
        ],
      };
      setLedTeam(myTeam);
      syncTeamTask(myTeam, null);
      setScreen("home");
      return merged;
    });
  };

  const handleProfileUpdate = (profile) => {
    setUser((prev) => ({
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
    }));
    setScreen("profile");
  };

  const handleSignOut = () => {
    setUser(null);
    setLedTeam(null);
    setJoinedTeam(null);
    setScreen("landing");
  };

  // Compute team progress for task 3 from BOTH teams
  const syncTeamTask = (led, joined) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === 3);
      if (idx < 0) return prev;
      const t = prev[idx];
      const cap = t.cap || 6;
      const ledTotal = led ? led.members.length + 1 : 0;
      const joinedTotal =
        joined && joined.status === "approved"
          ? (joined.currentCount || 0) + 1
          : 0;
      // Highest total wins for the task
      const total = Math.max(ledTotal, joinedTotal);
      const complete = total >= cap;
      const updated = {
        ...t,
        status:
          !led && !joined ? "todo" : complete ? "completed" : "in_progress",
        progress: Math.min(1, total / cap),
        teamProgress:
          led || joined ? { total, cap, ledTotal, joinedTotal } : null,
      };
      const n = [...prev];
      n[idx] = updated;
      return n;
    });
  };

  // Joining a team only — every user already leads their own team
  const joinTeam = (teamData) => {
    const newTeam = { ...teamData, role: "member" };
    setJoinedTeam(newTeam);
    syncTeamTask(ledTeam, newTeam);
    setSuccessData({
      color: "#6dae4a",
      points: 0,
      bonus: `已向「${newTeam.name}」送出申請，等待組長審核`,
      title: "申請已送出！",
    });
    setScreen("me");
  };

  const leaveLedTeam = () => {
    setLedTeam(null);
    syncTeamTask(null, joinedTeam);
  };
  const leaveJoinedTeam = () => {
    setJoinedTeam(null);
    syncTeamTask(ledTeam, null);
  };

  const approveRequest = (reqId) => {
    if (!ledTeam) return;
    const req = (ledTeam.requests || []).find((r) => r.id === reqId);
    if (!req) return;
    const updated = {
      ...ledTeam,
      members: [
        ...ledTeam.members,
        { id: req.id, name: req.name, avatar: req.avatar },
      ],
      requests: ledTeam.requests.filter((r) => r.id !== reqId),
    };
    setLedTeam(updated);
    syncTeamTask(updated, joinedTeam);
    if (updated.members.length + 1 >= 6) {
      const t3 = tasks.find((x) => x.id === 3);
      setSuccessData({
        color: t3.color,
        points: t3.points,
        bonus: t3.bonus,
        title: "組隊完成！",
      });
    }
  };

  const rejectRequest = (reqId) => {
    if (!ledTeam) return;
    setLedTeam({
      ...ledTeam,
      requests: (ledTeam.requests || []).filter((r) => r.id !== reqId),
    });
  };

  const renameTeam = (alias) => {
    if (!ledTeam) return;
    setLedTeam({ ...ledTeam, alias });
  };

  // Demo helper: simulate a member's request being approved externally
  const simulateJoinApproved = () => {
    if (!joinedTeam || joinedTeam.status !== "pending") return;
    const approved = { ...joinedTeam, status: "approved" };
    setJoinedTeam(approved);
    syncTeamTask(ledTeam, approved);
  };

  const completeTask = (id) => {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const t = tasks[idx];
    const updated = {
      ...t,
      status: "completed",
      steps: (t.steps || []).map((s) => ({ ...s, done: true })),
      progress: 1,
    };
    const newTasks = [...tasks];
    newTasks[idx] = updated;
    setTasks(newTasks);
    setScreen("taskDetail");
    setSuccessData({ color: t.color, points: t.points, bonus: t.bonus });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        background: "#F2ECDC",
        fontFamily: '"Noto Sans SC", "PingFang SC", -apple-system, sans-serif',
        overflow: "hidden",
      }}
    >
      <GlobalStyles />
      {screen === "landing" && (
        <LandingScreen
          onStart={() => setScreen("auth")}
        />
      )}
      {screen === "auth" && (
        <GoogleAuthScreen
          onCancel={() => setScreen("landing")}
          onSuccess={handleSignIn}
        />
      )}
      {screen === "profileSetup" && (
        <ProfileSetupForm
          user={user}
          onCancel={() => {
            setUser(null);
            setScreen("landing");
          }}
          onSubmit={handleProfileComplete}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          user={user}
          onBack={() => setScreen("me")}
          onEdit={() => setScreen("profileEdit")}
        />
      )}
      {screen === "profileEdit" && (
        <ProfileSetupForm
          user={user}
          initial={user}
          title="編輯個人資料"
          subtitle="更新你的基本資訊"
          submitLabel="儲存變更"
          onCancel={() => setScreen("profile")}
          onSubmit={handleProfileUpdate}
        />
      )}
      {screen === "home" && (
        <HomeScreen
          user={user}
          tasks={tasks}
          onSignOut={handleSignOut}
          onNavigate={navigateTo}
          onOpenTask={openTask}
        />
      )}
      {screen === "tasks" && (
        <TasksScreen
          tasks={tasks}
          onNavigate={setScreen}
          onOpenTask={openTask}
        />
      )}
      {screen === "rank" && (
        <RankScreen
          user={user}
          tasks={tasks}
          onNavigate={setScreen}
        />
      )}
      {screen === "taskDetail" && (
        <TaskDetailScreen
          tasks={tasks}
          taskId={currentTaskId}
          onBack={() => setScreen("tasks")}
          onOpenTask={openTask}
          onStartTask={openTaskForm}
          onGoMe={() => setScreen("me")}
        />
      )}
      {screen === "form" && currentTaskId === 1 && (
        <InterestForm
          onCancel={() => setScreen("taskDetail")}
          onSubmit={() => completeTask(1)}
        />
      )}
      {screen === "form" && currentTaskId === 2 && (
        <TicketForm
          onCancel={() => setScreen("taskDetail")}
          onSubmit={() => completeTask(2)}
        />
      )}
      {screen === "form" && currentTaskId === 3 && (
        <TeamForm
          onCancel={() => setScreen("me")}
          onSubmit={joinTeam}
        />
      )}
      {screen === "me" && (
        <MyScreen
          user={user}
          ledTeam={ledTeam}
          joinedTeam={joinedTeam}
          tasks={tasks}
          onSignOut={handleSignOut}
          onNavigate={navigateTo}
          onBuildTeam={() => {
            setCurrentTaskId(3);
            setScreen("form");
          }}
          onApproveRequest={approveRequest}
          onRejectRequest={rejectRequest}
          onRenameTeam={renameTeam}
          onCancelJoinRequest={leaveJoinedTeam}
          onLeaveLedTeam={leaveLedTeam}
          onLeaveJoinedTeam={leaveJoinedTeam}
          onSimulateJoinApproved={simulateJoinApproved}
          onOpenTask={openTask}
        />
      )}
      {screen === "rewards" && (
        <RewardsScreen
          user={user}
          tasks={tasks}
          onBack={() => setScreen(rewardsFrom)}
        />
      )}
      {successData && (
        <FormSuccessOverlay
          {...successData}
          onDone={() => setSuccessData(null)}
        />
      )}
    </div>
  );
}

export default App;
