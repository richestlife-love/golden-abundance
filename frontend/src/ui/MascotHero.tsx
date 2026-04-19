import SparkleGlyph from './SparkleGlyph';
import mascotHalfbodyUrl from '../assets/mascot-halfbody.png';

type Props = {
  size: number;
};

export default function MascotHero({ size }: Props) {
  const s = size; // diameter of the halo
  return (
    <div
      style={{
        position: "relative",
        width: s,
        height: s,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: s * 1.05,
          height: s * 1.05,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,220,240,0.9) 0%, rgba(220,220,255,0.5) 40%, transparent 70%)",
          filter: "blur(10px)",
        }}
      />
      {/* White core glow — brighter center behind mascot */}
      <div
        style={{
          position: "absolute",
          width: s * 0.95,
          height: s * 0.95,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 20%, rgba(255,250,235,0.5) 45%, transparent 70%)",
          filter: "blur(14px)",
          mixBlendMode: "normal",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: s * 0.55,
          height: s * 0.55,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.7) 40%, transparent 75%)",
          filter: "blur(8px)",
        }}
      />
      <svg
        width={s * 1.05}
        height={s * 1.05}
        style={{ position: "absolute", animation: "spin 30s linear infinite" }}
      >
        <circle
          cx="50%"
          cy="50%"
          r={s * 0.48}
          fill="none"
          stroke="rgba(254,210,52,0.5)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
      </svg>
      <img
        src={mascotHalfbodyUrl}
        style={{
          width: Math.min(s * 1.15, 560),
          height: Math.min(s * 1.05, 520),
          objectFit: "contain",
          objectPosition: "center bottom",
          position: "relative",
          marginBottom: -s * 0.05,
          filter: "drop-shadow(0 8px 20px rgba(100,80,1,0.18))",
          animation: "bobble 4.5s ease-in-out infinite",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 82%, rgba(0,0,0,0.6) 92%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 82%, rgba(0,0,0,0.6) 92%, transparent 100%)",
        }}
      />
      <SparkleGlyph x="8%" y="12%" size={s * 0.07} color="#fedd67" delay={0} />
      <SparkleGlyph
        x="88%"
        y="8%"
        size={s * 0.085}
        color="#fed234"
        delay={0.8}
      />
      <SparkleGlyph
        x="92%"
        y="76%"
        size={s * 0.055}
        color="#fedd67"
        delay={1.6}
      />
      <SparkleGlyph
        x="4%"
        y="68%"
        size={s * 0.065}
        color="#fee99a"
        delay={2.2}
      />
    </div>
  );
}
