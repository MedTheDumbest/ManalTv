"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { buildWatchProgress } from "@/lib/progress";
import { jsonFetch } from "@/lib/client-fetch";
import { EMPTY_HISTORY, watchHistoryStore } from "@/lib/remote-stores";
import type { HistoryResponse } from "@/lib/remote-stores";
import type { WatchProgress } from "@/types";

function subscribeHistory(listener: () => void): () => void {
  return watchHistoryStore.subscribe(listener);
}

function getHistorySnapshot(): WatchProgress[] {
  return watchHistoryStore.getSnapshot();
}

export function getWatchHistory(): WatchProgress[] {
  return watchHistoryStore.getSnapshot();
}

export function useWatchHistory() {
  const history = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    () => EMPTY_HISTORY
  );

  useEffect(() => {
    void watchHistoryStore.ensureLoaded();

    const handleFocus = () => {
      void watchHistoryStore.refresh();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const saveProgress = useCallback(async (progress: WatchProgress) => {
    try {
      const res = await jsonFetch<HistoryResponse>("/api/user/history", {
        method: "POST",
        body: JSON.stringify({ progress }),
      });

      if (Array.isArray(res.watchHistory)) {
        watchHistoryStore.replace(res.watchHistory);
      }
    } catch {
      await watchHistoryStore.refresh();
    }
  }, []);

  const advanceToNextEpisode = useCallback(
    (
      finished: Pick<WatchProgress, "tmdbId" | "mediaType" | "season">,
      nextEpisode: number
    ) => {
      void saveProgress(
        buildWatchProgress({
          tmdbId: finished.tmdbId,
          mediaType: finished.mediaType,
          season: finished.season,
          episode: nextEpisode,
          currentTime: 0,
          duration: 0,
          updatedAt: Date.now(),
        })
      );
    },
    [saveProgress]
  );

  const getHistory = useCallback((): WatchProgress[] => getHistorySnapshot(), []);

  const getProgress = useCallback(
    (tmdbId: number): WatchProgress | undefined =>
      getHistorySnapshot().find((entry) => entry.tmdbId === tmdbId),
    []
  );

  return { history, saveProgress, getHistory, getProgress, advanceToNextEpisode };
}