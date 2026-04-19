type Props = {
  x: number | string;
  y: number | string;
  size?: number;
  color?: string;
  delay?: number;
};

export default function SparkleGlyph({ x, y, size = 18, color = "#fff", delay = 0 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: x,
        top: y,
        animation: `sparklePulse 2.8s ease-in-out ${delay}s infinite`,
        filter: `drop-shadow(0 0 6px ${color})`,
      }}
    >
      <path
        d="M12,1 L13.5,10.5 L23,12 L13.5,13.5 L12,23 L10.5,13.5 L1,12 L10.5,10.5 Z"
        fill={color}
      />
    </svg>
  );
}
