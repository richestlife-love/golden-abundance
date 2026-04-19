import { fs } from "../utils";
import { useState } from "react";
import FormShell from "../ui/FormShell";
import FieldLabel from "../ui/FieldLabel";
import TextInput from "../ui/TextInput";
import ChipGroup from "../ui/ChipGroup";
import SubmitButton from "../ui/SubmitButton";
import type { User } from "../types";

type Props = {
  user: User | null;
  initial?: User | null;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (profile: Partial<User>) => void;
};

export default function ProfileSetupForm({
  user,
  initial,
  onCancel,
  onSubmit,
  title = "完善個人資料",
  subtitle = "初次加入，請填寫基本資訊，稍後可於「我的」中修改",
  submitLabel = "完成註冊",
}: Props) {
  const bg = "var(--bg)";
  const muted = "var(--muted)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid var(--card-strong)";
  const fg = "var(--fg)";

  const initEn =
    initial?.enName || ((user?.name || "").match(/[A-Za-z\s]/) ? user?.name || "" : "");
  const initZh =
    initial?.zhName || ((user?.name || "").match(/[\u4e00-\u9fa5]/) ? user?.name || "" : "");
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
  const REGIONS: Record<string, string[]> = {
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
  const COUNTRY_DIAL: Record<string, string> = {
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
  const handleCountry = (v: string) => {
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
            background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: fs(16),
            fontWeight: 800,
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(254,199,1,0.35)",
          }}
        >
          {(user?.name || "U").slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: fs(14), fontWeight: 700, color: fg }}>
            {user?.name || "新志工"}
          </div>
          <div
            style={{
              fontSize: fs(11),
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
        <FieldLabel required>中文姓名</FieldLabel>
        <TextInput value={zhName} onChange={setZhName} placeholder="請輸入你的中文姓名" />
      </div>

      <div style={card}>
        <FieldLabel>英文姓名</FieldLabel>
        <div
          style={{
            fontSize: fs(11),
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          如證件上之拼音 As per NRIC（選填）
        </div>
        <TextInput value={enName} onChange={setEnName} placeholder="e.g. Chia-Yi Lin" />
      </div>

      <div style={card}>
        <FieldLabel>暱稱 Nickname</FieldLabel>
        <div
          style={{
            fontSize: fs(11),
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          朋友們會這樣稱呼你（選填）
        </div>
        <TextInput value={nickname} onChange={setNickname} placeholder="e.g. 小佳 / Alice Ng" />
      </div>

      <div style={card}>
        <FieldLabel required>聯絡電話</FieldLabel>
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
                fontSize: fs(14),
                color: "var(--fg)",
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
                fontSize: fs(10),
                color: "var(--muted)",
              }}
            >
              ▾
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextInput value={phone} onChange={setPhone} placeholder="912-345-678" />
          </div>
        </div>
      </div>

      <div style={card}>
        <FieldLabel>LINE ID</FieldLabel>
        <div
          style={{
            fontSize: fs(11),
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          方便活動聯繫（選填）
        </div>
        <TextInput value={lineId} onChange={setLineId} placeholder="@your-line-id" />
      </div>

      <div style={card}>
        <FieldLabel>Telegram ID</FieldLabel>
        <div
          style={{
            fontSize: fs(11),
            color: muted,
            marginBottom: 10,
            marginTop: -4,
          }}
        >
          方便活動聯繫（選填）
        </div>
        <TextInput value={telegramId} onChange={setTelegramId} placeholder="@your-telegram-id" />
      </div>

      <div style={card}>
        <FieldLabel required>所在國家/地區</FieldLabel>
        <ChipGroup options={COUNTRIES} value={country} onChange={handleCountry} multi={false} />
      </div>

      {country && (
        <div style={card}>
          <FieldLabel required>所在城市/地區</FieldLabel>
          <div
            style={{
              fontSize: fs(11),
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
            <ChipGroup options={regions} value={location} onChange={setLocation} multi={false} />
          )}
        </div>
      )}
    </FormShell>
  );
}
