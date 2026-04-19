type Props = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
};

export default function ChipGroup({ options, value, onChange, multi = true }: Props) {
  const toggle = (opt: string) => {
    if (multi) {
      onChange(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt]);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange(opt as any);
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selected = (opt: string) => (multi ? value.includes(opt) : (value as any) === opt);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const sel = selected(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              border: sel ? "1.5px solid #cb9f01" : "1px solid rgba(254,210,52,0.35)",
              background: sel
                ? "linear-gradient(135deg, rgba(254,210,52,0.25), rgba(254,233,154,0.28))"
                : "rgba(255,255,255,0.6)",
              color: sel ? "#655001" : "#241c00",
              transition: "all 0.15s",
            }}
          >
            {sel && <span style={{ marginRight: 4 }}>✓</span>}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
