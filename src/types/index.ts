export type MediaType = "movie" | "tv";

export interface MediaItem {
  id: number;
  title: string;
  posterPath: string;
  type: MediaType;
  backdropPath: string;
  overview: string;
  year?: number;
  rating?: number;
}

export interface WatchProgress {
  tmdbId: number;
  mediaType: MediaType;
  season?: number;
  episode?: number;
  currentTime: number;
  duration: number;
  updatedAt: number;
  percentageWatched: number;
  timeRemaining: number;
  seasonEpisodeString: string | null;
}

export interface WatchlistItem {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string;
  backdropPath: string;
  addedAt: number;
}

export interface WatchQueueItem {
  tmdbId: number;
  mediaType: MediaType;
  season: number;
  episode: number;
  title: string;
  updatedAt: number;
}

export interface AppPreferences {
  lastActiveTab: MediaType;
  defaultVolume: number;
  playbackSpeed: number;
  watchQueue: WatchQueueItem[];
  playNextAuto: boolean;
}