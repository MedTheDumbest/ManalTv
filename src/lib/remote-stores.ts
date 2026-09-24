"use client";

import { getActiveProfileId } from "@/lib/client-auth";
import { jsonFetch } from "@/lib/client-fetch";
import { createRemoteStore } from "@/lib/remote-store";
import type { WatchProgress, WatchlistItem } from "@/types";

export const EMPTY_HISTORY: WatchProgress[] = [];
export const EMPTY_WATCHLIST: WatchlistItem[] = [];

export interface HistoryResponse {
  watchHistory: WatchProgress[];
}

export interface ListResponse {
  myList: WatchlistItem[];
}

function scopedUrl(base: string): string {
  const profileId = getActiveProfileId();

  return profileId ? `${base}?profile=${encodeURIComponent(profileId)}` : base;
}

function historyUrl(): string {
  return scopedUrl("/api/user/history");
}

function listUrl(): string {
  return scopedUrl("/api/user/list");
}

export const watchHistoryStore = createRemoteStore(EMPTY_HISTORY, async () => {
  const res = await jsonFetch<HistoryResponse>(historyUrl());

  return Array.isArray(res.watchHistory) ? res.watchHistory : EMPTY_HISTORY;
});

export const watchlistStore = createRemoteStore(EMPTY_WATCHLIST, async () => {
  const res = await jsonFetch<ListResponse>(listUrl());

  return Array.isArray(res.myList) ? res.myList : EMPTY_WATCHLIST;
});

export function resetRemoteStores(): void {
  watchHistoryStore.reset();
  watchlistStore.reset();
}