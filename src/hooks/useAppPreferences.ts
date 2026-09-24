"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { AppPreferences, MediaType, WatchQueueItem } from "@/types";

const PREFS_KEY = "streamMinimal_prefs";
const PREFS_EVENT = "streamMinimal_prefs:update";
const WATCHLIST_KEY = "streamMinimal_watchlist";
const WATCHLIST_EVENT = "streamMinimal_watchlist:update";

const DEFAULT_PREFS: AppPreferences = {
  lastActiveTab: "movie",
  defaultVolume: 1,
  playbackSpeed: 1,
  watchQueue: [],
  playNextAuto: false,
};

interface PreferencesSnapshot {
  prefs: AppPreferences;
  myList: number[];
}

let cachedSnapshot: PreferencesSnapshot | null = null;
const listeners = new Set<() => void>();

function readPreferences(): AppPreferences {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;

    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    const merged: AppPreferences = { ...DEFAULT_PREFS };

    if (parsed.lastActiveTab === "movie" || parsed.lastActiveTab === "tv") {
      merged.lastActiveTab = parsed.lastActiveTab;
    }

    if (typeof parsed.defaultVolume === "number" && Number.isFinite(parsed.defaultVolume)) {
      merged.defaultVolume = Math.min(Math.max(parsed.defaultVolume, 0), 1);
    }

    if (typeof parsed.playbackSpeed === "number" && Number.isFinite(parsed.playbackSpeed)) {
      merged.playbackSpeed = Math.min(Math.max(parsed.playbackSpeed, 0.5), 2);
    }

    if (typeof parsed.playNextAuto === "boolean") {
      merged.playNextAuto = parsed.playNextAuto;
    }

    if (Array.isArray(parsed.watchQueue)) {
      merged.watchQueue = parsed.watchQueue
        .filter(
          (item): item is WatchQueueItem =>
            item !== null &&
            typeof item === "object" &&
            typeof item.tmdbId === "number" &&
            (item.mediaType === "movie" || item.mediaType === "tv")
        )
        .slice(0, 200);
    }

    return merged;
  } catch {
    return DEFAULT_PREFS;
  }
}

function readMyList(): number[] {
  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry) =>
          entry !== null &&
          typeof entry === "object" &&
          typeof entry.tmdbId === "number"
      )
      .map((entry) => entry.tmdbId);
  } catch {
    return [];
  }
}

function getSnapshot(): PreferencesSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = { prefs: readPreferences(), myList: readMyList() };
  }

  return cachedSnapshot;
}

function invalidate() {
  cachedSnapshot = null;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const handlePrefsUpdate = () => {
    invalidate();
    emit();
  };

  const handleWatchlistUpdate = () => {
    invalidate();
    emit();
  };

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === PREFS_KEY ||
      event.key === WATCHLIST_KEY ||
      event.key === null
    ) {
      invalidate();
      emit();
    }
  };

  window.addEventListener(PREFS_EVENT, handlePrefsUpdate);
  window.addEventListener(WATCHLIST_EVENT, handleWatchlistUpdate);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(PREFS_EVENT, handlePrefsUpdate);
    window.removeEventListener(WATCHLIST_EVENT, handleWatchlistUpdate);
    window.removeEventListener("storage", handleStorage);
    listeners.delete(listener);
  };
}

export function updatePreferences(patch: Partial<AppPreferences>) {
  if (typeof window === "undefined") return;

  const next = { ...getSnapshot().prefs, ...patch };

  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    return;
  }

  window.dispatchEvent(new Event(PREFS_EVENT));
  emit();
}

export function pushWatchQueueItem(item: WatchQueueItem) {
  if (typeof window === "undefined") return;

  const queue = getSnapshot().prefs.watchQueue.filter(
    (entry) =>
      !(
        entry.tmdbId === item.tmdbId &&
        entry.mediaType === item.mediaType &&
        entry.season === item.season &&
        entry.episode === item.episode
      )
  );

  queue.unshift(item);
  updatePreferences({ watchQueue: queue.slice(0, 200) });
}

export function clearWatchQueue() {
  updatePreferences({ watchQueue: [] });
}

export function getPreferences(): AppPreferences {
  return getSnapshot().prefs;
}

export function getMyList(): number[] {
  return getSnapshot().myList;
}

export function useAppPreferences() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => ({ prefs: DEFAULT_PREFS, myList: [] })
  );

  const setLastActiveTab = useCallback((tab: MediaType) => {
    updatePreferences({ lastActiveTab: tab });
  }, []);

  return {
    prefs: snapshot.prefs,
    myList: snapshot.myList,
    setLastActiveTab,
    update: updatePreferences,
    pushQueue: pushWatchQueueItem,
  };
}