"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { jsonFetch } from "@/lib/client-fetch";
import { EMPTY_WATCHLIST, watchlistStore } from "@/lib/remote-stores";
import type { ListResponse } from "@/lib/remote-stores";
import type { MediaItem, MediaType, WatchlistItem } from "@/types";

function subscribeWatchlist(listener: () => void): () => void {
  return watchlistStore.subscribe(listener);
}

function getWatchlistSnapshot(): WatchlistItem[] {
  return watchlistStore.getSnapshot();
}

export function getWatchlist(): WatchlistItem[] {
  return watchlistStore.getSnapshot();
}

export function useWatchlist() {
  const items = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    () => EMPTY_WATCHLIST
  );

  useEffect(() => {
    void watchlistStore.ensureLoaded();

    const handleFocus = () => {
      void watchlistStore.refresh();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const toggle = useCallback(async (item: MediaItem) => {
    try {
      const res = await jsonFetch<ListResponse>("/api/user/list", {
        method: "POST",
        body: JSON.stringify({
          item: {
            tmdbId: item.id,
            mediaType: item.type,
            title: item.title,
            posterPath: item.posterPath,
            backdropPath: item.backdropPath,
            addedAt: Date.now(),
          },
        }),
      });

      if (Array.isArray(res.myList)) {
        watchlistStore.replace(res.myList);
      }
    } catch {
      await watchlistStore.refresh();
    }
  }, []);

  const isInList = useCallback(
    (tmdbId: number, mediaType: MediaType): boolean =>
      getWatchlistSnapshot().some(
        (entry) => entry.tmdbId === tmdbId && entry.mediaType === mediaType
      ),
    []
  );

  return { items, toggle, isInList };
}