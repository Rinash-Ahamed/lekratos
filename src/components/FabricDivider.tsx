/**
 * Flowing, fabric-like section edge. Pure SVG (no JS): a soft double-wave whose fill is `to`
 * (the colour of the section below) sits on top of the section above. Decorative.
 */
export function FabricDivider({ to = "var(--bg)", flip = false, className = "" }: { to?: string; flip?: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className={`block h-[48px] w-full md:h-[84px] ${className}`} style={{ transform: flip ? "scaleY(-1)" : undefined }}>
      <path d="M0 64 C 180 8 360 8 540 54 S 900 118 1100 62 S 1360 18 1440 52 V120 H0Z" fill={to} opacity="0.5" />
      <path d="M0 92 C 220 36 420 44 640 84 S 1040 120 1220 78 S 1390 52 1440 80 V120 H0Z" fill={to} />
    </svg>
  );
}
