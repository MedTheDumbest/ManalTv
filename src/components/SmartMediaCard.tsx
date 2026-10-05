"use client";

import Image from "next/image";
import Link from "next/link";
import WatchlistButton from "@/components/WatchlistButton";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { POSTER_SIZE, POSTER_SIZES_ATTR } from "@/lib/poster";
import { formatTimeRemaining, watchKey } from "@/lib/progress";
import { trackRowClick } from "@/lib/telemetry";
import type { MediaItem } from "@/types";

interface SmartMediaCardProps {
  item: MediaItem;
  sizes?: string;
  showNewBadge?: boolean;
  rowLabel?: string;
}

const IN_PROGRESS_MAX = 95;

export default function SmartMediaCard({
  item,
  sizes = POSTER_SIZES_ATTR,
  showNewBadge = false,
  rowLabel,
}: SmartMediaCardProps) {
  const { history } = useWatchHistory();

  const entry = history.find(
    (historyEntry) =>
      watchKey(historyEntry.mediaType, historyEntry.tmdbId) ===
      watchKey(item.type, item.id)
  );

  const percentage = entry?.percentageWatched ?? 0;
  const inProgress = percentage > 0 && percentage <= IN_PROGRESS_MAX;
  const watched = percentage > IN_PROGRESS_MAX;

  const footerText =
    inProgress && entry
      ? `${entry.seasonEpisodeString ? `${entry.seasonEpisodeString} · ` : ""}${formatTimeRemaining(entry.timeRemaining)}`
      : null;

  return (
    <div className={`flex-shrink-0 snap-start ${POSTER_SIZE}`}>
      <Link
        href={`/title/${item.type}/${item.id}`}
        aria-label={item.title}
        onClick={() => {
          trackRowClick(rowLabel ?? "row", {
            type: item.type,
            tmdbId: item.id,
          });
        }}
        className="group block relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded-lg bg-card"
      >
        {item.posterPath ? (
          <Image
            src={item.posterPath}
            alt={item.title}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-card text-muted text-xs text-center p-2">
            No Poster Available
          </div>
        )}

        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
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
        </div>

        <div className="absolute right-2 top-2 z-30">
          <WatchlistButton item={item} className="h-8 w-8" />
        </div>

        <div className="absolute bottom-2 right-2 z-20 flex flex-col items-end gap-1">
          {watched ? (
            <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
                className="h-3 w-3"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Watched
            </span>
          ) : showNewBadge ? (
            <span className="rounded-sm border border-white/8 bg-card/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-muted">
              New
            </span>
          ) : null}
        </div>

        {inProgress ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <div
              className="h-full bg-white/70"
              style={{ width: `${percentage}%` }}
            />
          </div>
        ) : null}
      </Link>

      <div className="mt-2 flex w-full flex-col gap-0.5">
        <h3 className="truncate text-sm font-medium text-white">
          {item.title}
        </h3>
        <p className="truncate text-xs text-muted">
          {footerText ?? (item.year ? String(item.year) : "\u00A0")}
        </p>
      </div>
    </div>
  );
}