import type { MediaItem, MediaType } from "@/types";
import type {
  CollectionList,
  TmdbVideo,
  TvEpisode,
  TvSeasonSummary,
  TvShowDetails,
} from "./tmdb-core";

export type {
  CollectionList,
  TmdbVideo,
  TvEpisode,
  TvSeasonSummary,
  TvShowDetails,
};

interface TmdbErrorResponse {
  error?: string;
}

export async function apiFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL("/api/tmdb", window.location.origin);
  url.searchParams.set("endpoint", endpoint);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    let message = `TMDB request failed (${response.status})`;

    const body = (await response.json().catch(() => null)) as
      | TmdbErrorResponse
      | null;

    if (body?.error) message = body.error;

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function getCollection(
  type: MediaType,
  list: CollectionList,
  page = 1
): Promise<MediaItem[]> {
  return apiFetch<MediaItem[]>("collection", {
    type,
    list,
    page: String(page),
  });
}

export async function getSimilar(
  type: MediaType,
  tmdbId: number
): Promise<MediaItem[]> {
  return apiFetch<MediaItem[]>("similar", {
    type,
    id: String(tmdbId),
  });
}

export async function searchMedia(
  query: string,
  page = 1
): Promise<MediaItem[]> {
  return apiFetch<MediaItem[]>("search", { query, page: String(page) });
}

export async function getMediaDetails(
  id: number,
  type: MediaType
): Promise<MediaItem> {
  return apiFetch<MediaItem>("details", { id: String(id), type });
}

export async function getTvDetails(tmdbId: number): Promise<TvShowDetails> {
  return apiFetch<TvShowDetails>("tv", { id: String(tmdbId) });
}

export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number
): Promise<TvEpisode[]> {
  return apiFetch<TvEpisode[]>("season", {
    id: String(tmdbId),
    season: String(seasonNumber),
  });
}

export async function getDiscover(
  type: MediaType,
  genreId: number,
  page = 1
): Promise<MediaItem[]> {
  return apiFetch<MediaItem[]>("discover", {
    type,
    genre: String(genreId),
    page: String(page),
  });
}

export async function getMediaVideos(
  type: MediaType,
  tmdbId: number
): Promise<TmdbVideo[]> {
  return apiFetch<TmdbVideo[]>("videos", {
    type,
    id: String(tmdbId),
  });
}

export async function getRecentlyReleased(
  type: MediaType
): Promise<MediaItem[]> {
  const items = await apiFetch<MediaItem[]>("recent", { type });
  const currentYear = new Date().getFullYear();

  return items.filter(
    (item) =>
      item.posterPath !== "" &&
      item.year !== undefined &&
      item.year <= currentYear
  );
}