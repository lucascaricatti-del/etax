export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Heading skeleton */}
      <div className="h-8 w-48 bg-[var(--color-line)] rounded-[var(--radius-btn)] mb-6" />

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="etax-card">
            <div className="h-3 w-20 bg-[var(--color-line)] rounded mb-3" />
            <div className="h-6 w-16 bg-[var(--color-line)] rounded" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="etax-card py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 w-40 bg-[var(--color-line)] rounded" />
              <div className="h-5 w-20 bg-[var(--color-line)] rounded-full" />
            </div>
            <div className="h-3 w-28 bg-[var(--color-line)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
