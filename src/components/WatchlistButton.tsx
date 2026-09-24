"use client";

import { useWatchlist } from "@/hooks/useWatchlist";
import type { MediaItem } from "@/types";

interface WatchlistButtonProps {
  item: MediaItem;
  className?: string;
}

export default function WatchlistButton({
  item,
  className = "",
}: WatchlistButtonProps) {
  const { isInList, toggle } = useWatchlist();
  const active = isInList(item.id, item.type);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggle(item);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "Remove from My List" : "Add to My List"}
      className={`flex shrink-0 items-center justify-center rounded-full backdrop-blur-md transition-transform duration-300 hover:scale-110 ${
        active
          ? "bg-white text-black hover:bg-white/90"
          : "bg-black/50 text-white hover:bg-white/20"
      } ${className}`}
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
          <path
            strokeLinecap="round"
            d="M12 5v14M5 12h14"
          />
        </svg>
      )}
    </button>
  );
}