type Props = { label: string; onClick: () => void; disabled?: boolean; color?: string };

export default function SubmitButton({ label, onClick, disabled, color = "#cb9f01" }: Props) {
  const muted = "rgba(40,30,70,0.45)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: 54,
        borderRadius: 16,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: 0.5,
        fontFamily: "inherit",
        background: disabled
          ? "rgba(100,80,1,0.15)"
          : `linear-gradient(135deg, ${color}, ${color}C0)`,
        color: disabled ? muted : "#fff",
        boxShadow: disabled ? "none" : `0 8px 24px ${color}50`,
      }}
    >
      {label}
    </button>
  );
}
