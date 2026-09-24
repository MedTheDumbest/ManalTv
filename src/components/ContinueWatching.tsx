"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import MediaRowSection from "@/components/MediaRowSection";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { POSTER_SIZE, POSTER_SIZES_ATTR } from "@/lib/poster";
import { getMediaDetails } from "@/lib/tmdb";
import { mediaKey } from "@/lib/format";
import { formatTimeRemaining } from "@/lib/progress";
import type { MediaItem, WatchProgress } from "@/types";

interface ContinueWatchingItem {
  progress: WatchProgress;
  media: MediaItem;
}

export default function ContinueWatching() {
  const { history } = useWatchHistory();
  const [mediaByKey, setMediaByKey] = useState<Map<string, MediaItem>>(
    () => new Map()
  );

  useEffect(() => {
    let cancelled = false;

    const missing = history.filter(
      (entry) => !mediaByKey.has(mediaKey(entry.mediaType, entry.tmdbId))
    );

    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (entry): Promise<[string, MediaItem] | null> => {
        try {
          const media = await getMediaDetails(entry.tmdbId, entry.mediaType);
          return [mediaKey(entry.mediaType, entry.tmdbId), media];
        } catch {
          return null;
        }
      })
    ).then((resolved) => {
      if (cancelled) return;

      const additions = new Map<string, MediaItem>();

      for (const result of resolved) {
        if (result) additions.set(result[0], result[1]);
      }

      if (additions.size === 0) return;

      setMediaByKey((current) => {
        const next = new Map(current);

        for (const [key, media] of additions) {
          next.set(key, media);
        }

        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [history, mediaByKey]);

  const displayItems = history
    .map((entry) => {
      const media = mediaByKey.get(mediaKey(entry.mediaType, entry.tmdbId));
      return media ? { progress: entry, media } : null;
    })
    .filter((entry): entry is ContinueWatchingItem => entry !== null)
    .sort((a, b) => b.progress.updatedAt - a.progress.updatedAt);

  if (displayItems.length === 0) return null;

  return (
    <MediaRowSection title="Continue Watching">
      {displayItems.map(({ progress, media }, index) => {
        const progressPct =
          progress.duration > 0
            ? Math.min((progress.currentTime / progress.duration) * 100, 100)
            : 0;

        const isNextUp =
          progress.mediaType === "tv" &&
          progress.currentTime === 0 &&
          progress.seasonEpisodeString !== null;

        const metaLabel = isNextUp
          ? `${progress.seasonEpisodeString} · Next episode`
          : progress.seasonEpisodeString
            ? `${progress.seasonEpisodeString} · ${formatTimeRemaining(progress.timeRemaining)}`
            : formatTimeRemaining(progress.timeRemaining);

        return (
          <Link
            key={mediaKey(progress.mediaType, progress.tmdbId)}
            href={`/watch/${progress.mediaType}/${progress.tmdbId}`}
            className="group flex shrink-0 snap-start flex-col"
          >
            <span className={`relative block aspect-[2/3] shrink-0 overflow-hidden rounded-lg bg-card transition-transform duration-300 group-hover:scale-[1.02] ${POSTER_SIZE}`}>
              {media.posterPath ? (
                <Image
                  src={media.posterPath}
                  alt={media.title}
                  fill
                  sizes={POSTER_SIZES_ATTR}
                  loading={index < 4 ? "eager" : "lazy"}
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-card text-muted text-xs text-center p-2">
                  No Poster Available
                </div>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="flex h-12 w-12 scale-90 items-center justify-center rounded-full border border-white/20 bg-white/10 text-primary backdrop-blur-md transition-transform duration-300 group-hover:scale-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className="ml-0.5 h-5 w-5"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
              <span className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                <span
                  className="block h-full bg-white"
                  style={{ width: `${progressPct}%` }}
                />
              </span>
            </span>
            <span className="mt-2 flex w-full flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-white">
                {media.title}
              </span>
              <span className="truncate text-xs text-muted">
                {metaLabel}
              </span>
            </span>
          </Link>
        );
      })}
    </MediaRowSection>
  );
}