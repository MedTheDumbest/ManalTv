import type { MediaType, WatchProgress } from "@/types";

interface ProgressInput {
  tmdbId: number;
  mediaType: MediaType;
  season?: number;
  episode?: number;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

const MAX_PERCENTAGE = 100;

export function buildWatchProgress(input: ProgressInput): WatchProgress {
  const duration = input.duration > 0 ? input.duration : 0;
  const percentageWatched =
    duration > 0
      ? Math.min(
          MAX_PERCENTAGE,
          Math.round((input.currentTime / duration) * 1000) / 10
        )
      : 0;
  const timeRemaining =
    duration > 0 ? Math.max(duration - input.currentTime, 0) : 0;
  const seasonEpisodeString =
    input.mediaType === "tv" &&
    input.season !== undefined &&
    input.episode !== undefined
      ? `S${input.season} E${input.episode}`
      : null;

  return {
    ...input,
    duration,
    percentageWatched,
    timeRemaining,
    seasonEpisodeString,
  };
}

export function formatTimeRemaining(timeRemainingSeconds: number): string {
  const minutes = Math.ceil(timeRemainingSeconds / 60);
  return `${minutes}m left`;
}

export function watchKey(mediaType: MediaType, tmdbId: number): string {
  return `${mediaType}-${tmdbId}`;
}