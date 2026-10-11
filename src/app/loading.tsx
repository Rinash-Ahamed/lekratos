export default function Loading() {
  return <div className="wrap py-16" aria-busy="true" aria-label="Loading"><div className="skeleton h-12 w-2/3 max-w-xl" /><div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton aspect-[4/5]" />)}</div></div>;
}
