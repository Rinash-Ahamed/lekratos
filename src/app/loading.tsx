export default function Loading() {
  return (
    <div className="wrap py-20" aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-3 h-10 w-48" />
      <div className="skeleton mb-14 h-5 w-2/3 max-w-sm" />
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-4" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="skeleton aspect-[4/5]" />
            <div className="skeleton h-5 w-3/4" />
            <div className="skeleton h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
