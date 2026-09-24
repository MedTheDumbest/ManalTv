import { describe, expect, it } from "vitest";
import type { GenreOption, TmdbResult } from "./tmdb-core";
import {
  GENRES,
  filterReleasedResults,
  genreIdFor,
  parseSeasonEpisodes,
  pickTrailer,
  toMediaItem,
} from "./tmdb-core";

describe("filterReleasedResults", () => {
  it("keeps released titles with a poster and a valid past date", () => {
    const results: TmdbResult[] = [
      {
        id: 1,
        title: "Released Movie",
        poster_path: "/p.jpg",
        backdrop_path: "/b.jpg",
        overview: "O",
        release_date: "2020-06-15",
      },
    ];

    expect(filterReleasedResults(results)).toHaveLength(1);
  });

  it("drops titles whose release date is in the future", () => {
    const results: TmdbResult[] = [
      {
        id: 2,
        title: "Future Movie",
        poster_path: "/p.jpg",
        backdrop_path: "/b.jpg",
        overview: "O",
        release_date: "2099-01-01",
      },
      {
        id: 3,
        title: "Future Show",
        poster_path: "/p.jpg",
        backdrop_path: "/b.jpg",
        overview: "O",
        first_air_date: "2029-12-31",
      },
    ];

    expect(filterReleasedResults(results)).toHaveLength(0);
  });

  it("drops titles missing a poster", () => {
    const results: TmdbResult[] = [
      {
        id: 4,
        title: "No Poster",
        poster_path: null,
        backdrop_path: "/b.jpg",
        overview: "O",
        release_date: "2020-06-15",
      },
    ];

    expect(filterReleasedResults(results)).toHaveLength(0);
  });

  it("drops titles without any date or with a malformed date", () => {
    const results: TmdbResult[] = [
      {
        id: 5,
        title: "No Date",
        poster_path: "/p.jpg",
        backdrop_path: "/b.jpg",
        overview: "O",
      },
      {
        id: 6,
        title: "Bad Date",
        poster_path: "/p.jpg",
        backdrop_path: "/b.jpg",
        overview: "O",
        release_date: "not-a-date",
      },
    ];

    expect(filterReleasedResults(results)).toHaveLength(0);
  });

  it("uses first_air_date as the release date for shows", () => {
    const results: TmdbResult[] = [
      {
        id: 7,
        name: "Released Show",
        poster_path: "/p.jpg",
        backdrop_path: "/b.jpg",
        overview: "O",
        first_air_date: "2019-03-01",
      },
    ];

    expect(filterReleasedResults(results)).toHaveLength(1);
  });
});

describe("toMediaItem", () => {
  it("maps TMDB movie fields and builds image URLs", () => {
    const item = toMediaItem(
      {
        id: 1,
        title: "Test Movie",
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        overview: "An overview.",
        vote_average: 8.7,
        release_date: "2024-05-10",
      },
      "movie"
    );

    expect(item).toEqual({
      id: 1,
      title: "Test Movie",
      type: "movie",
      posterPath: "https://image.tmdb.org/t/p/w500/poster.jpg",
      backdropPath: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
      overview: "An overview.",
      year: 2024,
      rating: 8.7,
    });
  });

  it("handles missing dates, ratings, and images", () => {
    const item = toMediaItem(
      {
        id: 2,
        name: "Test Show",
        poster_path: null,
        backdrop_path: null,
        overview: "Y",
      },
      "tv"
    );

    expect(item.title).toBe("Test Show");
    expect(item.type).toBe("tv");
    expect(item.year).toBeUndefined();
    expect(item.rating).toBeUndefined();
    expect(item.posterPath).toBe("");
    expect(item.backdropPath).toBe("");
  });

  it("rounds ratings to one decimal place", () => {
    const item = toMediaItem(
      {
        id: 3,
        title: "T",
        poster_path: null,
        backdrop_path: null,
        overview: null,
        vote_average: 7.09,
      },
      "movie"
    );

    expect(item.rating).toBe(7.1);
  });

  it("rejects malformed release dates", () => {
    const item = toMediaItem(
      {
        id: 4,
        title: "T",
        poster_path: null,
        backdrop_path: null,
        overview: null,
        release_date: "2024",
      },
      "movie"
    );

    expect(item.year).toBeUndefined();
  });
});

describe("parseSeasonEpisodes", () => {
  it("maps episode payloads", () => {
    const episodes = parseSeasonEpisodes({
      episodes: [{ episode_number: 3, name: "Night", overview: "Desc" }],
    });

    expect(episodes).toEqual([
      { episodeNumber: 3, name: "Night", overview: "Desc" },
    ]);
  });

  it("returns an empty array when episodes are missing", () => {
    expect(parseSeasonEpisodes({})).toEqual([]);
  });
});

describe("pickTrailer", () => {
  it("prefers the official trailer over teasers and generic clips", () => {
    const key = pickTrailer([
      { key: "generic", site: "YouTube", type: "Trailer", name: "Clip" },
      { key: "official-teaser", site: "YouTube", type: "Teaser", official: true, name: "Teaser" },
      { key: "official-trailer", site: "YouTube", type: "Trailer", official: true, name: "Trailer" },
    ]);

    expect(key).toBe("official-trailer");
  });

  it("falls back to an official teaser when no trailer exists", () => {
    expect(
      pickTrailer([
        { key: "teaser", site: "YouTube", type: "Teaser", official: true, name: "Teaser" },
      ])
    ).toBe("teaser");
  });

  it("does not fall back to unofficial clips", () => {
    expect(
      pickTrailer([{ key: "teaser", site: "YouTube", type: "Teaser", name: "Teaser" }])
    ).toBeUndefined();
  });

  it("ignores non-YouTube uploads", () => {
    expect(
      pickTrailer([{ key: "clip", site: "Vimeo", type: "Trailer", name: "Clip" }])
    ).toBeUndefined();
  });
});

describe("genreIdFor", () => {
  it("returns the movie id for movies and the tv id for shows", () => {
    const horror = GENRES.find((genre) => genre.key === "horror");

    expect(horror).toBeDefined();
    expect(genreIdFor(horror as GenreOption, "movie")).toBe(
      (horror as GenreOption).movieId
    );
    expect(genreIdFor(horror as GenreOption, "tv")).toBe(
      (horror as GenreOption).tvId
    );
  });
});