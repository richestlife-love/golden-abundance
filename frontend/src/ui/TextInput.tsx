type Props = { value: string; onChange: (value: string) => void; placeholder?: string; };

export default function TextInput({ value, onChange, placeholder }: Props) {
  const fg = "#241c00";
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        height: 46,
        padding: "0 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.85)",
        fontSize: 14,
        color: fg,
        fontFamily: "inherit",
        outline: "none",
        boxSizing: "border-box",
        border: "1px solid rgba(254, 210, 52, 0.4)",
        boxShadow: "none",
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
