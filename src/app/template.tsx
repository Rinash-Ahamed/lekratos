/** Re-mounts per navigation: a short opacity/transform entrance (replaces the old smooth-scroll shell). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
