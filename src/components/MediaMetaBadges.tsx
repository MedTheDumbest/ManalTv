import { formatRating } from "@/lib/format";
import type { MediaItem } from "@/types";

interface MediaMetaBadgesProps {
  item: MediaItem;
}

export default function MediaMetaBadges({ item }: MediaMetaBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-300">
      {item.year ? <span>{item.year}</span> : null}
      {item.rating ? (
        <span className="flex items-center gap-1 font-medium text-white">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="h-4 w-4 text-amber-400"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
          </svg>
          {formatRating(item.rating)}
        </span>
      ) : null}
      <span className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">
        {item.type === "tv" ? "TV" : "Movie"}
      </span>
    </div>
  );
}