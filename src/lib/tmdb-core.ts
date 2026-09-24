import type { MediaItem, MediaType } from "@/types";

export const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type CollectionList = "trending" | "popular" | "top_rated";

export interface GenreOption {
  key: string;
  label: string;
  movieId: number;
  tvId: number;
}

export const GENRES: GenreOption[] = [
  { key: "action", label: "Action", movieId: 28, tvId: 10759 },
  { key: "drama", label: "Drama", movieId: 18, tvId: 18 },
  { key: "comedy", label: "Comedy", movieId: 35, tvId: 35 },
  { key: "scifi", label: "Sci-Fi", movieId: 878, tvId: 10765 },
  { key: "horror", label: "Horror", movieId: 27, tvId: 9648 },
  { key: "thriller", label: "Thriller", movieId: 53, tvId: 53 },
  { key: "romance", label: "Romance", movieId: 10749, tvId: 10749 },
  { key: "animation", label: "Animation", movieId: 16, tvId: 16 },
  { key: "fantasy", label: "Fantasy", movieId: 14, tvId: 10765 },
  { key: "documentary", label: "Documentary", movieId: 99, tvId: 99 },
];

export function genreIdFor(genre: GenreOption, type: MediaType): number {
  return type === "movie" ? genre.movieId : genre.tvId;
}

export interface TmdbVideo {
  key: string;
  site: "YouTube" | string;
  type: string;
  name: string;
  official?: boolean;
}

export function pickTrailer(videos: TmdbVideo[]): string | undefined {
  const youTube = videos.filter((video) => video.site === "YouTube");

  const officialTrailer = youTube.find(
    (video) => video.type === "Trailer" && video.official
  );
  const officialTeaser = youTube.find(
    (video) => video.type === "Teaser" && video.official
  );
  const anyTrailer = youTube.find((video) => video.type === "Trailer");

  return (officialTrailer ?? officialTeaser ?? anyTrailer)?.key;
}

export interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

const RELEASE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function filterReleasedResults(results: TmdbResult[]): TmdbResult[] {
  const today = new Date();

  return results.filter((result) => {
    if (!result.poster_path) return false;

    const dateString = result.release_date ?? result.first_air_date;
    if (!dateString) return false;

    const releaseDate = new Date(dateString);
    if (Number.isNaN(releaseDate.getTime())) return false;

    return releaseDate <= today;
  });
}

export function toMediaItem(result: TmdbResult, type: MediaType): MediaItem {
  const rawDate = result.release_date ?? result.first_air_date ?? "";
  const year =
    RELEASE_DATE_REGEX.test(rawDate) ? Number(rawDate.slice(0, 4)) : undefined;

  const rating =
    typeof result.vote_average === "number"
      ? Math.round(result.vote_average * 10) / 10
      : undefined;

  return {
    id: result.id,
    title: result.title ?? result.name ?? "",
    posterPath: result.poster_path
      ? `${IMAGE_BASE_URL}/w500${result.poster_path}`
      : "",
    backdropPath: result.backdrop_path
      ? `${IMAGE_BASE_URL}/w1280${result.backdrop_path}`
      : "",
    type,
    overview: result.overview ?? "",
    year,
    rating,
  };
}

export interface TvSeasonSummary {
  seasonNumber: number;
  episodeCount: number;
}

export interface TvShowDetails extends MediaItem {
  seasons: TvSeasonSummary[];
}

export interface TvEpisode {
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath?: string;
  runtime?: number;
}

export interface TmdbTvDetails extends TmdbResult {
  seasons?: { season_number?: number; episode_count?: number }[];
}

export function parseTvDetails(result: TmdbTvDetails): TvShowDetails {
  return {
    ...toMediaItem(result, "tv"),
    seasons: (result.seasons ?? [])
      .filter((season) => typeof season.season_number === "number")
      .map((season) => ({
        seasonNumber: season.season_number as number,
        episodeCount: season.episode_count ?? 0,
      })),
  };
}

interface TmdbEpisode {
  episode_number: number;
  name: string;
  overview: string;
  still_path?: string | null;
  runtime?: number | null;
}

export interface SeasonResponse {
  episodes?: TmdbEpisode[];
}

export function parseSeasonEpisodes(data: SeasonResponse): TvEpisode[] {
  return (data.episodes ?? []).map((episode) => ({
    episodeNumber: episode.episode_number,
    name: episode.name,
    overview: episode.overview,
    stillPath: episode.still_path
      ? `${IMAGE_BASE_URL}/w500${episode.still_path}`
      : undefined,
    runtime: episode.runtime ?? undefined,
  }));
}