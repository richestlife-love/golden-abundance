import { fs } from "../utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export default function Textarea({ value, onChange, placeholder, rows = 3 }: Props) {
  return (
    <textarea
      className="ga-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ padding: "12px 14px", fontSize: fs(14), resize: "vertical", lineHeight: 1.5 }}
    />
  );
}
