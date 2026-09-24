import { describe, expect, it } from "vitest";
import { buildWatchProgress, formatTimeRemaining } from "./progress";

describe("buildWatchProgress", () => {
  it("computes percentage, time remaining and season string for TV", () => {
    const result = buildWatchProgress({
      tmdbId: 1396,
      mediaType: "tv",
      season: 2,
      episode: 4,
      currentTime: 1200,
      duration: 1800,
      updatedAt: 1000,
    });

    expect(result.percentageWatched).toBe(66.7);
    expect(result.timeRemaining).toBe(600);
    expect(result.seasonEpisodeString).toBe("S2 E4");
  });

  it("returns null season string for movies", () => {
    const result = buildWatchProgress({
      tmdbId: 603,
      mediaType: "movie",
      currentTime: 300,
      duration: 600,
      updatedAt: 1000,
    });

    expect(result.seasonEpisodeString).toBeNull();
    expect(result.percentageWatched).toBe(50);
    expect(result.timeRemaining).toBe(300);
  });

  it("handles zero duration without dividing by zero", () => {
    const result = buildWatchProgress({
      tmdbId: 603,
      mediaType: "movie",
      currentTime: 0,
      duration: 0,
      updatedAt: 1000,
    });

    expect(result.percentageWatched).toBe(0);
    expect(result.timeRemaining).toBe(0);
  });

  it("caps percentage at 100 and floors time remaining at 0", () => {
    const result = buildWatchProgress({
      tmdbId: 603,
      mediaType: "movie",
      currentTime: 700,
      duration: 600,
      updatedAt: 1000,
    });

    expect(result.percentageWatched).toBe(100);
    expect(result.timeRemaining).toBe(0);
  });
});

describe("formatTimeRemaining", () => {
  it("ceil-rounds seconds to minutes", () => {
    expect(formatTimeRemaining(301)).toBe("6m left");
    expect(formatTimeRemaining(0)).toBe("0m left");
  });
});