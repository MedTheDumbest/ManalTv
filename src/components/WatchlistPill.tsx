"use client";

import { useWatchlist } from "@/hooks/useWatchlist";
import type { MediaItem } from "@/types";

interface WatchlistPillProps {
  item: MediaItem;
}

export default function WatchlistPill({ item }: WatchlistPillProps) {
  const { isInList, toggle } = useWatchlist();
  const active = isInList(item.id, item.type);

  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      aria-pressed={active}
      className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/20"
    >
      {active ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 12l5 5L20 7"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      )}
      {active ? "In My List" : "My List"}
    </button>
  );
}