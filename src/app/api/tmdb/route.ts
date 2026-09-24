import { NextRequest, NextResponse } from "next/server";
import {
  TmdbRequestError,
  getCollection,
  getDiscover,
  getMediaDetails,
  getMediaVideos,
  getRecentlyReleased,
  getSeasonEpisodes,
  getSimilar,
  getTrending,
  getTvDetails,
  searchMedia,
} from "@/lib/tmdb-server";
import type { CollectionList } from "@/lib/tmdb-server";
import { parseEnum, parsePage, parsePositiveInt } from "@/lib/validate";
import type { MediaType } from "@/types";

const MEDIA_TYPES = ["movie", "tv"] as const;
const VALID_LISTS = new Set<CollectionList>([
  "trending",
  "popular",
  "top_rated",
]);

const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const hitsByIp = new Map<string, number[]>();

const LOOPBACK_IPS = new Set([
  "::1",
  "127.0.0.1",
  "::ffff:127.0.0.1",
  "localhost",
]);

const BROWSER_MAX_AGE =
  process.env.NODE_ENV === "production" ? ", max-age=3600" : ", max-age=0";
const CACHE_CONTROL = `public, s-maxage=3600${BROWSER_MAX_AGE}, stale-while-revalidate=3600`;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function jsonResponse(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": CACHE_CONTROL } });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hitsByIp.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );

  if (recent.length >= RATE_LIMIT) {
    hitsByIp.set(ip, recent);
    return true;
  }

  recent.push(now);
  hitsByIp.set(ip, recent);

  if (hitsByIp.size > 10_000) {
    const pruneCutoff = Date.now() - RATE_WINDOW_MS;

    for (const [key, timestamps] of hitsByIp) {
      const active = timestamps.some((timestamp) => timestamp >= pruneCutoff);

      if (!active) hitsByIp.delete(key);
    }
  }

  return false;
}

function clientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  const forwarded = request.headers.get("x-forwarded-for");

  return (
    realIp ??
    (forwarded ? (forwarded.split(",")[0] ?? "").trim() : "unknown")
  ).toLowerCase();
}

export async function GET(request: NextRequest) {
  const ip = clientIp(request);

  if (!LOOPBACK_IPS.has(ip) && isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = request.nextUrl;
  const endpoint = searchParams.get("endpoint");
  const rawType = searchParams.get("type");
  const rawList = searchParams.get("list");
  const id = parsePositiveInt(searchParams.get("id"));
  const query = (searchParams.get("query") ?? "").trim();
  const season = parsePositiveInt(searchParams.get("season"));
  const page = parsePage(searchParams);

  let type: MediaType | null = null;

  if (rawType !== null) {
    const parsed = parseEnum(rawType, MEDIA_TYPES);

    if (!parsed) return badRequest(`Invalid 'type': ${rawType}`);

    type = parsed;
  }

  try {
    switch (endpoint) {
      case "trending": {
        if (!type) return badRequest("Missing or invalid 'type'");

        return jsonResponse(await getTrending(type));
      }

      case "collection": {
        if (!type) return badRequest("Missing or invalid 'type'");
        if (!rawList || !VALID_LISTS.has(rawList as CollectionList)) {
          return badRequest("Missing or invalid 'list'");
        }

        return jsonResponse(await getCollection(type, rawList as CollectionList, page));
      }

      case "details": {
        if (!type || id === null) {
          return badRequest("Missing or invalid 'type' or 'id'");
        }

        return jsonResponse(await getMediaDetails(String(id), type));
      }

      case "similar": {
        if (!type || id === null) {
          return badRequest("Missing or invalid 'type' or 'id'");
        }

        try {
          return jsonResponse(await getSimilar(type, id));
        } catch (error) {
          if (error instanceof TmdbRequestError && error.status === 404) {
            return NextResponse.json({ error: "Title not found" }, { status: 404 });
          }

          throw error;
        }
      }

      case "tv": {
        if (id === null) {
          return badRequest("Missing or invalid 'id'");
        }

        return jsonResponse(await getTvDetails(id));
      }

      case "season": {
        if (id === null || season === null) {
          return badRequest("Missing or invalid 'id' or 'season'");
        }

        return jsonResponse(await getSeasonEpisodes(id, season));
      }

      case "search": {
        if (!query) {
          return badRequest("Missing 'query'");
        }

        return jsonResponse(await searchMedia(query, page));
      }

      case "discover": {
        if (!type) return badRequest("Missing or invalid 'type'");
        const genre = parsePositiveInt(searchParams.get("genre"));

        if (genre === null) {
          return badRequest("Missing or invalid 'genre'");
        }

        return jsonResponse(await getDiscover(type, genre, page));
      }

      case "recent": {
        if (!type) return badRequest("Missing or invalid 'type'");

        return jsonResponse(await getRecentlyReleased(type, page));
      }

      case "videos": {
        if (!type || id === null) {
          return badRequest("Missing or invalid 'type' or 'id'");
        }

        return jsonResponse(await getMediaVideos(type, id));
      }

      default:
        return badRequest(
          `Unsupported endpoint: ${endpoint ?? "(missing)"}`
        );
    }
  } catch (error) {
    console.error("TMDB proxy error:", error);

    if (error instanceof TmdbRequestError) {
      const message = error.message;

      if (error.networkError) {
        return NextResponse.json(
          { error: message },
          { status: 502, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (
        error.status === 400 ||
        error.status === 404 ||
        error.status === 422
      ) {
        return NextResponse.json({ error: message }, { status: error.status });
      }

      return NextResponse.json(
        { error: message },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}