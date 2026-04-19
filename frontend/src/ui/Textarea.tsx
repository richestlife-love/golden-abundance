type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export default function Textarea({ value, onChange, placeholder, rows = 3 }: Props) {
  const fg = "#241c00";
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid rgba(254,210,52,0.4)",
        background: "rgba(255,255,255,0.85)",
        fontSize: 14,
        color: fg,
        fontFamily: "inherit",
        outline: "none",
        boxSizing: "border-box",
        resize: "vertical",
        lineHeight: 1.5,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "#cb9f01";
        e.target.style.boxShadow = "0 0 0 3px rgba(254,199,1,0.25)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "rgba(254,210,52,0.4)";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}
