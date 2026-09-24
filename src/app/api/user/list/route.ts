import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvConfigured, readUserData, writeUserData } from "@/lib/kv";
import { ACTIVE_PROFILE_COOKIE, isProfileId } from "@/lib/accounts";
import type { MediaType, WatchlistItem } from "@/types";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

async function getProfileId() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;
  return isProfileId(value) ? value : null;
}

function unauthorized() {
  return json({ error: "Not authenticated" }, 401);
}

function storageUnavailable() {
  return json({ error: "Storage not configured" }, 503);
}

export async function GET() {
  const profileId = await getProfileId();
  if (!profileId) return unauthorized();
  if (!kvConfigured) return storageUnavailable();

  const data = await readUserData(profileId);
  return json({ myList: data.myList });
}

export async function POST(request: Request) {
  const profileId = await getProfileId();
  if (!profileId) return unauthorized();
  if (!kvConfigured) return storageUnavailable();

  const body = (await request.json().catch(() => null)) as
    | { item?: unknown }
    | null;

  const candidate = body?.item;
  if (!candidate || typeof candidate !== "object") {
    return json({ error: "Invalid request" }, 400);
  }

  const item = candidate as Partial<WatchlistItem>;

  if (
    typeof item.tmdbId !== "number" ||
    (item.mediaType !== "movie" && item.mediaType !== "tv") ||
    typeof item.title !== "string"
  ) {
    return json({ error: "Invalid item" }, 400);
  }

  const tmdbId: number = item.tmdbId;
  const mediaType: MediaType = item.mediaType;
  const title: string = item.title;
  const posterPath = typeof item.posterPath === "string" ? item.posterPath : "";
  const backdropPath =
    typeof item.backdropPath === "string" ? item.backdropPath : "";
  const addedAt = typeof item.addedAt === "number" ? item.addedAt : Date.now();

  const data = await readUserData(profileId);
  const index = data.myList.findIndex(
    (entry) => entry.tmdbId === tmdbId && entry.mediaType === mediaType
  );

  if (index !== -1) {
    data.myList.splice(index, 1);
  } else {
    data.myList.push({
      tmdbId,
      mediaType,
      title,
      posterPath,
      backdropPath,
      addedAt,
    });
  }

  data.myList.sort((a, b) => b.addedAt - a.addedAt);

  await writeUserData(profileId, data);

  return json({ myList: data.myList });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
}