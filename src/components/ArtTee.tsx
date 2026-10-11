import type { ArtKind } from "@/lib/types";

/**
 * Procedural T-shirt artwork used until the owner uploads real photography.
 * All colours are fixed (NOT theme tokens) so product imagery stays identical
 * on every page.
 */

const TEE_PATH =
  "M140 40 C160 62 240 62 260 40 L338 70 L388 150 L330 178 L310 150 L310 430 Q200 446 90 430 L90 150 L70 178 L12 150 L62 70 Z";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function Art({ kind, seed, ink, alt }: { kind: ArtKind; seed: number; ink: string; alt: string }) {
  const r = rng(seed);
  const cx = 200;
  switch (kind) {
    case "sun":
      return (
        <g>
          <circle cx={cx} cy={236} r={58} fill={alt} />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={cx - 74} y={262 + i * 9} width={148} height={3 + i * 1.2} fill={ink} />
          ))}
          <rect x={cx - 82} y={206} width={164} height={2} fill={ink} />
        </g>
      );
    case "grid":
      return (
        <g stroke={ink} strokeWidth={1.4}>
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={140 + i * 15} y1={176} x2={140 + i * 15 + (r() - 0.5) * 6} y2={300} />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1={140} y1={176 + i * 15} x2={260} y2={176 + i * 15 + (r() - 0.5) * 5} />
          ))}
          {Array.from({ length: 36 }, (_, i) => (
            <rect key={i} x={140 + r() * 112} y={296 + r() * 22} width={4} height={4} fill={alt} stroke="none" />
          ))}
        </g>
      );
    case "wave":
      return (
        <g fill="none" stroke={ink} strokeWidth={2.2}>
          {Array.from({ length: 11 }, (_, i) => (
            <path
              key={i}
              d={`M128 ${190 + i * 11} q 18 ${-14 - (i % 3) * 4} 36 0 t 36 0 t 36 0 t 36 0`}
              stroke={i === 5 ? alt : ink}
              strokeWidth={i === 5 ? 3.4 : 2}
            />
          ))}
        </g>
      );
    case "eye":
      return (
        <g>
          <path d="M122 240 Q200 168 278 240 Q200 312 122 240Z" fill="none" stroke={ink} strokeWidth={2.4} />
          <circle cx={cx} cy={240} r={30} fill={alt} />
          <circle cx={cx} cy={240} r={12} fill={ink} />
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1={150 + i * 11} y1={318 + (i % 2) * 4} x2={150 + i * 11} y2={332} stroke={ink} strokeWidth={2} />
          ))}
        </g>
      );
    case "bloom":
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2 + r() * 0.3;
            return (
              <ellipse
                key={i}
                cx={cx + Math.cos(a) * 34}
                cy={240 + Math.sin(a) * 34}
                rx={30}
                ry={13}
                transform={`rotate(${(a * 180) / Math.PI} ${cx + Math.cos(a) * 34} ${240 + Math.sin(a) * 34})`}
                fill={i % 2 ? ink : alt}
                opacity={0.88}
              />
            );
          })}
          <circle cx={cx} cy={240} r={11} fill={ink} />
          <path d={`M${cx} 290 q -6 40 -30 56`} stroke={ink} strokeWidth={2.4} fill="none" />
        </g>
      );
    case "stripe":
    default:
      return (
        <g>
          <rect x={138} y={196} width={124} height={34} fill={ink} />
          <rect x={138} y={240} width={124} height={34} fill={alt} />
          <rect x={138} y={284} width={124} height={34} fill={ink} />
        </g>
      );
  }
}

export function ArtTee({
  kind,
  seed,
  color,
  className,
  label,
}: {
  kind: ArtKind;
  seed: number;
  color: string;
  className?: string;
  label?: string;
}) {
  const dark = luminance(color) < 0.45;
  const ink = dark ? "#F1ECE0" : "#16161A";
  const alt = dark ? "#C9B8FF" : "#E4572E";
  const shade = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  return (
    <svg
      viewBox="0 0 400 480"
      role="img"
      aria-label={label ?? "T-shirt design"}
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="480" fill="#DAD6CB" />
      <ellipse cx="200" cy="448" rx="150" ry="14" fill="rgba(0,0,0,0.12)" />
      <path d={TEE_PATH} fill={color} />
      <path d={TEE_PATH} fill="none" stroke={shade} strokeWidth="2" />
      <path d="M140 40 C160 62 240 62 260 40" fill="none" stroke={shade} strokeWidth="6" />
      <path d="M90 150 L90 430 M310 150 L310 430" stroke={shade} strokeWidth="1" />
      <Art kind={kind} seed={seed} ink={ink} alt={alt} />
    </svg>
  );
}
