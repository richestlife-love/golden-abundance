import { useState } from "react";
import FormShell from "../ui/FormShell";
import FieldLabel from "../ui/FieldLabel";
import TextInput from "../ui/TextInput";
import ChipGroup from "../ui/ChipGroup";
import SubmitButton from "../ui/SubmitButton";

type Props = {
  onCancel: () => void;
  onSubmit: () => void;
};

export default function InterestForm({ onCancel, onSubmit }: Props) {
  const bg = "#FFFDF5";
  const muted = "rgba(50,40,0,0.6)";
  const cardBg = "rgba(255,255,255,0.6)";
  const cardBorder = "1px solid rgba(255,255,255,0.9)";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);

  const valid = name.trim() && phone.trim() && interests.length > 0 && availability.length > 0;
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
        <SubmitButton label="提交表單" onClick={onSubmit} disabled={!valid} color="#fec701" />
      }
    >
      <div style={card}>
        <FieldLabel required>姓名</FieldLabel>
        <TextInput value={name} onChange={setName} placeholder="請輸入你的姓名" />
      </div>

      <div style={card}>
        <FieldLabel required>聯絡電話</FieldLabel>
        <TextInput value={phone} onChange={setPhone} placeholder="09xx-xxxxxx" />
      </div>

      <div style={card}>
        <FieldLabel required>興趣方向</FieldLabel>
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
        <FieldLabel required>可投入時段</FieldLabel>
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
