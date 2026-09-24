import type { MediaItem, MediaType } from "@/types";
import {
  TMDB_API_BASE_URL,
  filterReleasedResults,
  parseSeasonEpisodes,
  parseTvDetails,
  pickTrailer,
  toMediaItem,
  type CollectionList,
  type SeasonResponse,
  type TmdbResult,
  type TmdbTvDetails,
  type TmdbVideo,
  type TvEpisode,
  type TvShowDetails,
} from "./tmdb-core";

export type { CollectionList } from "./tmdb-core";

const REVALIDATE_SECONDS = 3600;
const REQUEST_TIMEOUT_MS = 10000;

export class TmdbRequestError extends Error {
  readonly status?: number;
  readonly networkError: boolean;

  constructor(
    message: string,
    options: { status?: number; networkError?: boolean } = {}
  ) {
    super(message);
    this.name = "TmdbRequestError";
    this.status = options.status;
    this.networkError = options.networkError ?? false;
  }
}

function getTmdbApiKey(): string {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not set. Add it to .env.local");
  }

  return apiKey;
}

export async function tmdbFetchServer<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  url.searchParams.set("api_key", getTmdbApiKey());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new TmdbRequestError(
      `TMDB unreachable: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      { networkError: true }
    );
  }

  if (!response.ok) {
    throw new TmdbRequestError(`TMDB request failed (${response.status}): ${path}`, {
      status: response.status,
    });
  }

  return (await response.json()) as T;
}

interface MediaListResponse {
  results: TmdbResult[];
}

interface MultiSearchResult extends TmdbResult {
  media_type?: string;
}

interface MultiSearchResponse {
  results: MultiSearchResult[];
}

export async function getTrending(type: MediaType): Promise<MediaItem[]> {
  return getCollection(type, "trending");
}

interface TrendingAllResult extends TmdbResult {
  media_type?: string;
}

interface TrendingAllResponse {
  results: TrendingAllResult[];
}

export interface BillboardData {
  item: MediaItem;
  trailerKey: string | null;
}

export async function getBillboard(): Promise<BillboardData | null> {
  const data = await tmdbFetchServer<TrendingAllResponse>("/trending/all/day", {
    language: "en-US",
  });

  const candidates = data.results.filter((result) => {
    if (result.media_type !== "movie" && result.media_type !== "tv") return false;
    if (!result.backdrop_path || !result.overview) return false;
    return typeof result.vote_average === "number";
  });

  candidates.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));

  const pick = candidates[0];
  if (!pick) return null;

  const mediaType = pick.media_type as MediaType;
  const item = toMediaItem(pick, mediaType);
  const videos = await getMediaVideos(mediaType, item.id).catch(() => []);

  return {
    item,
    trailerKey: pickTrailer(videos) ?? null,
  };
}

export async function getCollection(
  type: MediaType,
  list: CollectionList,
  page = 1
): Promise<MediaItem[]> {
  const path =
    list === "trending"
      ? `/trending/${type}/week`
      : `/${type}/${list}`;

  const data = await tmdbFetchServer<MediaListResponse>(path, {
    page: String(page),
  });

  return data.results.map((result) => toMediaItem(result, type));
}

export async function searchMedia(
  query: string,
  page = 1
): Promise<MediaItem[]> {
  const data = await tmdbFetchServer<MultiSearchResponse>("/search/multi", {
    query,
    page: String(page),
  });

  return data.results
    .filter(
      (result) => result.media_type === "movie" || result.media_type === "tv"
    )
    .map((result) => toMediaItem(result, result.media_type as MediaType));
}

export async function getSimilar(
  type: MediaType,
  tmdbId: number
): Promise<MediaItem[]> {
  const path =
    type === "movie"
      ? `/movie/${tmdbId}/similar`
      : `/tv/${tmdbId}/recommendations`;

  const data = await tmdbFetchServer<MediaListResponse>(path);

  return data.results.map((result) => toMediaItem(result, type));
}

export async function getMediaDetails(
  id: string,
  type: MediaType
): Promise<MediaItem> {
  const result = await tmdbFetchServer<TmdbResult>(`/${type}/${id}`);

  return toMediaItem(result, type);
}

interface MediaDetailsWithVideos {
  item: MediaItem;
  trailerKey: string | null;
}

export async function getMediaDetailsWithVideos(
  id: string,
  type: MediaType
): Promise<MediaDetailsWithVideos> {
  const result = await tmdbFetchServer<
    TmdbResult & { videos?: { results?: TmdbVideo[] } }
  >(`/${type}/${id}`, { append_to_response: "videos" });

  return {
    item: toMediaItem(result, type),
    trailerKey: pickTrailer(result.videos?.results ?? []) ?? null,
  };
}

export async function getTvDetails(tmdbId: number): Promise<TvShowDetails> {
  return parseTvDetails(
    await tmdbFetchServer<TmdbTvDetails>(`/tv/${tmdbId}`)
  );
}

export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number
): Promise<TvEpisode[]> {
  return parseSeasonEpisodes(
    await tmdbFetchServer<SeasonResponse>(`/tv/${tmdbId}/season/${seasonNumber}`)
  );
}

interface TmdbVideosResponse {
  results?: TmdbVideo[];
}

export async function getMediaVideos(
  type: MediaType,
  tmdbId: number
): Promise<TmdbVideo[]> {
  const data = await tmdbFetchServer<TmdbVideosResponse>(
    `/${type}/${tmdbId}/videos`
  );

  return data.results ?? [];
}

export async function getDiscover(
  type: MediaType,
  genreId: number,
  page = 1
): Promise<MediaItem[]> {
  const data = await tmdbFetchServer<MediaListResponse>(`/discover/${type}`, {
    with_genres: String(genreId),
    sort_by: "popularity.desc",
    include_adult: "false",
    page: String(page),
  });

  return data.results.map((result) => toMediaItem(result, type));
}

export async function getRecentlyReleased(
  type: MediaType,
  page = 1
): Promise<MediaItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const isMovie = type === "movie";

  const params: Record<string, string> = {
    sort_by: isMovie ? "primary_release_date.desc" : "first_air_date.desc",
    "vote_count.gte": "5",
    include_adult: "false",
    with_original_language: "en",
    page: String(page),
  };

  if (isMovie) {
    params["primary_release_date.lte"] = today;
  } else {
    params["first_air_date.lte"] = today;
  }

  const data = await tmdbFetchServer<MediaListResponse>(
    `/discover/${type}`,
    params
  );

  return filterReleasedResults(data.results)
    .map((result) => toMediaItem(result, type))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}