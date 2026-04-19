export default function GoogleSpinner() {
  return (
    <div style={{ width: 28, height: 28, position: "relative" }}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        style={{ animation: "spin 1.4s linear infinite" }}
      >
        <circle
          cx="14"
          cy="14"
          r="11"
          fill="none"
          stroke="#1A73E8"
          strokeWidth="2.5"
          strokeDasharray="30 100"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
