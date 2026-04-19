import { fs } from "../utils";
import PaperBackground from "../ui/PaperBackground";
import MascotHero from "../ui/MascotHero";
import Headline from "../ui/Headline";
import GradientButton from "../ui/GradientButton";

type Props = { onStart: () => void };

// Hero is the smaller of 90% of the container's short edge (cqi) and 48% of
// its height (cqb), clamped between 200 and 480px. Title follows the same
// shape but scaled down. Using container-query units keeps the hero sized
// to the screen itself even when the app is embedded in a narrower frame.
const HERO_SIZE = "clamp(200px, min(90cqi, 48cqb), 480px)";
const TITLE_SIZE = "clamp(28px, min(11.5cqi, 5.5cqb), 46px)";

export default function LandingScreen({ onStart }: Props) {
  return (
    <div
      data-screen-label="Landing"
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        color: "var(--fg)",
        containerType: "size",
      }}
    >
      <PaperBackground />

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "6px 28px 24px",
          minHeight: 0,
        }}
      >
        {/* Brand chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: 0.85,
            animation: "fadeInDown 0.8s ease",
            paddingTop: 4,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(254,199,1,0.3)",
            }}
          >
            <span
              style={{
                color: "#fff",
                fontSize: fs(16),
                fontWeight: 400,
                fontFamily: "var(--font-display)",
                lineHeight: 1,
              }}
            >
              金
            </span>
          </div>
          <span
            style={{
              fontSize: fs(12),
              fontWeight: 500,
              letterSpacing: 3,
              color: "#987701",
              fontFamily: "var(--font-display)",
            }}
          >
            金富有 · GOLDEN ABUNDANCE
          </span>
        </div>

        {/* Hero */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
            animation: "fadeInUp 0.9s 0.1s ease backwards",
          }}
        >
          <MascotHero sizeCss={HERO_SIZE} />
        </div>

        {/* Headline */}
        <div
          style={{
            animation: "fadeInUp 0.9s 0.25s ease backwards",
            flexShrink: 0,
          }}
        >
          <Headline text="金富有志工" fontSizeCss={TITLE_SIZE} />
        </div>

        {/* Subtitle */}
        <div
          style={{
            textAlign: "center",
            marginTop: 14,
            marginBottom: 22,
            fontSize: fs(14),
            fontWeight: 400,
            letterSpacing: 4,
            color: "#987701",
            fontFamily: "var(--font-sans)",
            animation: "fadeInUp 0.9s 0.4s ease backwards",
            flexShrink: 0,
          }}
        >
          成就屬於自己的光明宇宙
        </div>

        {/* CTA */}
        <div
          style={{
            animation: "fadeInUp 0.9s 0.55s ease backwards",
            flexShrink: 0,
          }}
        >
          <GradientButton label="开启" onClick={onStart} />
        </div>
      </div>
    </div>
  );
}
