import { Skeleton } from "@/components/ui";

export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-[220px] w-full" />
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-[220px] w-full" />
        </div>
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  );
}
