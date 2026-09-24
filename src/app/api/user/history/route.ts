import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvConfigured, readUserData, writeUserData } from "@/lib/kv";
import { ACTIVE_PROFILE_COOKIE, isProfileId } from "@/lib/accounts";
import { buildWatchProgress } from "@/lib/progress";
import type { WatchProgress } from "@/types";

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
  return json({ watchHistory: data.watchHistory });
}

export async function POST(request: Request) {
  const profileId = await getProfileId();
  if (!profileId) return unauthorized();
  if (!kvConfigured) return storageUnavailable();

  const body = (await request.json().catch(() => null)) as
    | { progress?: unknown }
    | null;

  const candidate = body?.progress;
  if (!candidate || typeof candidate !== "object") {
    return json({ error: "Invalid request" }, 400);
  }

  const input = candidate as Partial<WatchProgress>;

  if (
    typeof input.tmdbId !== "number" ||
    (input.mediaType !== "movie" && input.mediaType !== "tv")
  ) {
    return json({ error: "Invalid progress" }, 400);
  }

  const progress = buildWatchProgress({
    tmdbId: input.tmdbId,
    mediaType: input.mediaType,
    season: typeof input.season === "number" ? input.season : undefined,
    episode: typeof input.episode === "number" ? input.episode : undefined,
    currentTime:
      typeof input.currentTime === "number"
        ? Math.max(input.currentTime, 0)
        : 0,
    duration:
      typeof input.duration === "number" ? Math.max(input.duration, 0) : 0,
    updatedAt:
      typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
  });

  const data = await readUserData(profileId);
  const index = data.watchHistory.findIndex(
    (entry) =>
      entry.tmdbId === progress.tmdbId &&
      entry.mediaType === progress.mediaType
  );

  const existing = index === -1 ? undefined : data.watchHistory[index];

  if (existing) {
    const isStaleCompletion =
      progress.mediaType === "tv" &&
      typeof progress.season === "number" &&
      typeof progress.episode === "number" &&
      progress.duration > 0 &&
      existing.mediaType === "tv" &&
      existing.season === progress.season &&
      typeof existing.episode === "number" &&
      existing.episode > progress.episode &&
      existing.currentTime <= 0;

    data.watchHistory[index] = isStaleCompletion ? existing : progress;
  } else {
    data.watchHistory.push(progress);
  }

  data.watchHistory.sort((a, b) => b.updatedAt - a.updatedAt);

  await writeUserData(profileId, data);

  return json({ watchHistory: data.watchHistory });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
}