"use client";

import { useState } from "react";
import MediaRow from "@/components/MediaRow";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { MediaItem } from "@/types";

const MAX_ITEMS = 24;

export default function MyList() {
  const { items } = useWatchlist();
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const mediaItems: MediaItem[] = items.map((entry) => ({
    id: entry.tmdbId,
    title: entry.title,
    posterPath: entry.posterPath,
    backdropPath: entry.backdropPath,
    overview: "",
    type: entry.mediaType,
  }));

  const visible = showAll ? mediaItems : mediaItems.slice(0, MAX_ITEMS);

  const headerAction =
    items.length > MAX_ITEMS ? (
      <button
        type="button"
        onClick={() => setShowAll((current) => !current)}
        className="flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-primary"
      >
        <span>{showAll ? "Show less" : "See all"}</span>
        <span aria-hidden="true">{showAll ? "↑" : "→"}</span>
      </button>
    ) : null;

  return (
    <MediaRow
      title={`My List · ${items.length}`}
      items={visible}
      headerAction={headerAction}
    />
  );
}