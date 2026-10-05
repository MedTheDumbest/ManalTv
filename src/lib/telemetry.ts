import type { TelemetryEventName } from "@/lib/telemetry-server";

export interface TrackData {
  [key: string]: string | number | boolean | undefined;
}

function track(name: TelemetryEventName, data: TrackData = {}): void {
  if (typeof window === "undefined") return;

  const payload: TrackData = {};

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) payload[key] = value;
  }

  const body = JSON.stringify({
    name,
    data: { ...payload, path: `${window.location.pathname}${window.location.search}` },
  });

  try {
    const blob = new Blob([body], { type: "application/json" });

    if (navigator.sendBeacon?.("/api/telemetry", blob)) return;

    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry is best effort.
  }
}

interface MediaRef {
  type: "movie" | "tv";
  tmdbId: number;
  title?: string;
  season?: number;
  episode?: number;
  genres?: number[];
  genreNames?: string;
  duration?: number;
}

export function trackWatchStart(media: MediaRef): void {
  track("watch_start", {
    type: media.type,
    tmdbId: media.tmdbId,
    title: media.title ?? "",
    season: media.season ?? 0,
    episode: media.episode ?? 0,
    genres: (media.genres ?? []).join(","),
    genreNames: media.genreNames ?? "",
    duration: media.duration ?? 0,
  });
}

export function trackWatchStop(
  media: MediaRef,
  seconds: number,
  percentage: number
): void {
  track("watch_stop", {
    type: media.type,
    tmdbId: media.tmdbId,
    title: media.title ?? "",
    season: media.season ?? 0,
    episode: media.episode ?? 0,
    seconds: Math.max(0, Math.round(seconds)),
    pct: Math.round(percentage),
  });
}

export function trackWatchComplete(media: MediaRef): void {
  track("watch_complete", {
    type: media.type,
    tmdbId: media.tmdbId,
    title: media.title ?? "",
    season: media.season ?? 0,
    episode: media.episode ?? 0,
  });
}

export function trackSearch(query: string): void {
  track("search", { query });
}

export function trackSurprisePick(media: Pick<MediaRef, "type" | "tmdbId">): void {
  track("surprise_pick", { type: media.type, tmdbId: media.tmdbId });
}

export function trackRowClick(
  row: string,
  media: Pick<MediaRef, "type" | "tmdbId">
): void {
  track("row_click", { row, type: media.type, tmdbId: media.tmdbId });
}

export function trackListToggle(
  added: boolean,
  media: Pick<MediaRef, "type" | "tmdbId" | "title">
): void {
  track("list_toggle", {
    added: String(added),
    type: media.type,
    tmdbId: media.tmdbId,
    title: media.title ?? "",
  });
}

export function trackSeasonSwitch(season: number): void {
  track("season_switch", { season });
}

export function trackDrawerOpen(season: number, episodes: number): void {
  track("drawer_open", { season, episodes });
}

export function trackPlayerError(
  media: Pick<MediaRef, "type" | "tmdbId">,
  detail: string
): void {
  track("player_error", {
    type: media.type,
    tmdbId: media.tmdbId,
    detail: detail.slice(0, 140),
  });
}

export function trackApiError(path: string, status: number): void {
  track("api_error", { path: path.slice(0, 140), status });
}

export function trackNavigation(path: string): void {
  track("navigation", { path: path.slice(0, 140) });
}