type MultiProps = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: true;
};

type SingleProps = {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  multi: false;
};

type Props = MultiProps | SingleProps;

export default function ChipGroup(props: Props) {
  const { options } = props;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const isActive = props.multi === false ? props.value === opt : props.value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (props.multi === false) {
                props.onChange(opt);
              } else {
                const next = props.value.includes(opt)
                  ? props.value.filter((x) => x !== opt)
                  : [...props.value, opt];
                props.onChange(next);
              }
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              border: isActive ? "1.5px solid #cb9f01" : "1px solid rgba(254,210,52,0.35)",
              background: isActive
                ? "linear-gradient(135deg, rgba(254,210,52,0.25), rgba(254,233,154,0.28))"
                : "rgba(255,255,255,0.6)",
              color: isActive ? "#655001" : "#241c00",
              transition: "all 0.15s",
            }}
          >
            {isActive && <span style={{ marginRight: 4 }}>✓</span>}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
