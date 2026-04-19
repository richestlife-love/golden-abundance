import { fs } from "../utils";

type Props = { value: string; onChange: (value: string) => void; placeholder?: string };

export default function TextInput({ value, onChange, placeholder }: Props) {
  return (
    <input
      type="text"
      className="ga-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ height: 46, fontSize: fs(14) }}
    />
  );
}
