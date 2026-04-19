import { useState, useEffect, useRef } from "react";
import PaperBackground from "../ui/PaperBackground";
import MascotHero from "../ui/MascotHero";
import Headline from "../ui/Headline";
import GradientButton from "../ui/GradientButton";

type Props = { onStart: () => void };

export default function LandingScreen({ onStart }: Props) {
  const getInitial = () => {
    const w = Math.min(typeof window !== "undefined" ? window.innerWidth : 390, 440);
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return { w: w || 390, h: h || 800 };
  };
  const [dims, setDims] = useState(getInitial);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (rootRef.current) {
        const r = rootRef.current.getBoundingClientRect();
        // guard against zero readings before layout has settled
        if (r.width > 0 && r.height > 0) {
          setDims({ w: r.width, h: r.height });
        }
      }
    };
    // measure on next frame AND after a tick, so layout has settled
    const raf = requestAnimationFrame(update);
    const t = setTimeout(update, 80);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      ro = new ResizeObserver(update);
      ro.observe(rootRef.current);
    }
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Responsive scaling based on viewport, with sensible floors
  const short = Math.max(Math.min(dims.w || 390, 440), 280);
  const tall = Math.max(dims.h || 800, 520);
  const heroSize = Math.max(Math.min(short * 0.9, tall * 0.48, 480), 200);
  const titleSize = Math.max(Math.min(short * 0.115, tall * 0.055, 46), 28);

  return (
    <div
      ref={rootRef}
      data-screen-label="Landing"
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        color: "#241c00",
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
              background: "linear-gradient(135deg, #fed234, #fec701)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(254,199,1,0.3)",
            }}
          >
            <span
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: 900,
                fontFamily: '"Noto Serif SC", serif',
              }}
            >
              金
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 2,
              color: "#987701",
              fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
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
          <MascotHero size={heroSize} />
        </div>

        {/* Headline */}
        <div
          style={{
            animation: "fadeInUp 0.9s 0.25s ease backwards",
            flexShrink: 0,
          }}
        >
          <Headline text="金富有志工" fontSize={titleSize} />
        </div>

        {/* Subtitle */}
        <div
          style={{
            textAlign: "center",
            marginTop: 14,
            marginBottom: 22,
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: 4,
            color: "#987701",
            fontFamily: '"Noto Sans SC", "PingFang SC", sans-serif',
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
