import { useState } from "react";
import FormShell from "../ui/FormShell";
import FieldLabel from "../ui/FieldLabel";
import TextInput from "../ui/TextInput";
import Textarea from "../ui/Textarea";
import SubmitButton from "../ui/SubmitButton";

type Props = {
  onCancel: () => void;
  onSubmit: () => void;
};

export default function TicketForm({ onCancel, onSubmit }: Props) {
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
        <SubmitButton label="提交報名" onClick={onSubmit} disabled={!valid} color="#8AD4B0" />
      }
    >
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(138,212,176,0.18), rgba(138,212,176,0.08))",
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
        <FieldLabel required>姓名</FieldLabel>
        <TextInput value={name} onChange={setName} placeholder="請輸入你的姓名" />
      </div>

      <div style={card}>
        <FieldLabel required>7/25 票券編號</FieldLabel>
        <TextInput value={ticket725} onChange={setTicket725} placeholder="例如：RL-0725-8420" />
        <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
          可於購票 Email 或錢包中找到 12 位編號
        </div>
      </div>

      <div style={card}>
        <FieldLabel required>7/26 票券編號</FieldLabel>
        <TextInput value={ticket726} onChange={setTicket726} placeholder="例如：RL-0726-1173" />
      </div>

      <div style={card}>
        <FieldLabel>備註</FieldLabel>
        <Textarea value={note} onChange={setNote} placeholder="飲食需求、交通協助等（可留白）" />
      </div>
    </FormShell>
  );
}
