import Redis from "ioredis";
import { dataKeyForProfile } from "@/lib/accounts";
import type { ProfileId } from "@/lib/accounts";
import type { WatchlistItem, WatchProgress } from "@/types";

export interface UserData {
  watchHistory: WatchProgress[];
  myList: WatchlistItem[];
}

const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL;

export const kvConfigured = Boolean(REDIS_URL);

const EMPTY_DATA: UserData = { watchHistory: [], myList: [] };

let client: Redis | null = null;
let connectPromise: Promise<void> | null = null;

function getClient(): Redis | null {
  if (!REDIS_URL) return null;

  if (!client) {
    client = new Redis(REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      keepAlive: 30000,
    });
  }

  return client;
}

async function ensureConnected(c: Redis): Promise<void> {
  if (c.status === "ready") return;

  if (!connectPromise) {
    connectPromise = c.connect().finally(() => {
      connectPromise = null;
    });
  }

  return connectPromise;
}

export async function readUserData(profileId: ProfileId): Promise<UserData> {
  const c = getClient();
  if (!c) return EMPTY_DATA;

  try {
    await ensureConnected(c);
    const raw = await c.get(dataKeyForProfile(profileId));

    if (!raw) return EMPTY_DATA;

    const parsed = JSON.parse(raw) as Partial<UserData> | null;

    if (!parsed || typeof parsed !== "object") return EMPTY_DATA;

    return {
      watchHistory: Array.isArray(parsed.watchHistory)
        ? parsed.watchHistory
        : [],
      myList: Array.isArray(parsed.myList) ? parsed.myList : [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

export async function writeUserData(
  profileId: ProfileId,
  data: UserData
): Promise<void> {
  const c = getClient();
  if (!c) return;

  try {
    await ensureConnected(c);
    await c.set(dataKeyForProfile(profileId), JSON.stringify(data));
  } catch {
    // Ignore storage write failures.
  }
}