import { POSTER_SIZE } from "@/lib/poster";

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section className="space-y-3">
      <div className="mx-4 h-6 w-48 motion-safe:animate-pulse rounded bg-card md:mx-8" />
      <div className="flex gap-3 overflow-hidden px-4 pb-2 md:px-8">
        {[0, 1, 2, 3, 4, 5].slice(0, count).map((poster) => (
          <div
            key={poster}
            className={`aspect-[2/3] shrink-0 motion-safe:animate-pulse rounded-lg bg-card ${POSTER_SIZE}`}
          />
        ))}
      </div>
    </section>
  );
}