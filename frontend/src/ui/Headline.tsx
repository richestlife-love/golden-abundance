type Props = {
  text: string;
  fontSizeCss: string;
};

export default function Headline({ text, fontSizeCss }: Props) {
  return (
    <div
      style={{
        textAlign: "center",
        lineHeight: 1,
        fontSize: fontSizeCss,
        fontWeight: 400,
        letterSpacing: 6,
        fontFamily: "var(--font-display)",
        background: "linear-gradient(180deg, #cb9f01 0%, #987701 55%, #655001 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 2px 4px rgba(254,199,1,0.45))",
        color: "rgb(203, 159, 1)",
      }}
    >
      {text}
    </div>
  );
}
