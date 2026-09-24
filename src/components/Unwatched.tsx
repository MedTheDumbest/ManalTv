"use client";

import MediaRow from "@/components/MediaRow";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { useWatchlist } from "@/hooks/useWatchlist";
import { watchKey } from "@/lib/progress";
import type { MediaItem } from "@/types";

const MAX_ITEMS = 24;

export default function Unwatched() {
  const { items } = useWatchlist();
  const { history } = useWatchHistory();

  const watchedKeys = new Set(
    history
      .filter(
        (entry) =>
          entry.currentTime > 0 ||
          (entry.percentageWatched !== undefined && entry.percentageWatched > 0)
      )
      .map((entry) => watchKey(entry.mediaType, entry.tmdbId))
  );

  const unwatched = items.filter(
    (entry) => !watchedKeys.has(watchKey(entry.mediaType, entry.tmdbId))
  );

  if (unwatched.length === 0) return null;

  const mediaItems: MediaItem[] = unwatched.map((entry) => ({
    id: entry.tmdbId,
    title: entry.title,
    posterPath: entry.posterPath,
    backdropPath: entry.backdropPath,
    overview: "",
    type: entry.mediaType,
  }));

  return (
    <MediaRow
      title="Unwatched"
      items={mediaItems.slice(0, MAX_ITEMS)}
    />
  );
}