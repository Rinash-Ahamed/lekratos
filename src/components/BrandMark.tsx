/**
 * The official le.kratos wordmark. Two mask layers (supplied artwork split by colour) so the
 * two-tone logo keeps its design on every theme. The untouched original lives at /brand/logo.png.
 */
export function BrandMark({ className = "", label = "le.kratos" }: { className?: string; label?: string }) {
  return (
    <span className={`brand-mark ${className}`} role="img" aria-label={label}>
      <i aria-hidden />
      <i aria-hidden />
    </span>
  );
}
