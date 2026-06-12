// CTR wordmark — brand red #E2231A, sampled from the official site logo
// (https://www.ctr.co.kr/img/head/head_logo.png, dominant opaque pixel color).
// Text-based mark until CTR's official SVG asset arrives (spec §5 deployment
// inputs); it fills the same component slot as the upstream logo glyph so
// call sites stay one-line changes.
export default function CtrLogo({ size = 22 }: { size?: number }) {
  return (
    <span
      className="font-display select-none font-extrabold italic leading-none tracking-tight"
      style={{ fontSize: size, color: "rgb(var(--c-accent-3))" }}
      aria-label="CTR"
    >
      CTR
    </span>
  );
}
