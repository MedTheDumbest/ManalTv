import { createHmac, createHash } from "node:crypto";
import type { ProfileId } from "@/lib/accounts";
import { PROFILES, dataKeyForProfile } from "@/lib/accounts";
import { getRedis, kvConfigured, readUserData } from "@/lib/kv";

const EVENT_RING_MAX = 500;
const SECURITY_RING_MAX = 200;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;
const EVENT_TTL_SECONDS = 60 * 60 * 24 * 90;
const ROLLUP_TTL_SECONDS = 60 * 60 * 24 * 400;
const SECURITY_TTL_SECONDS = 60 * 60 * 24 * 180;
const LOGIN_FAIL_TTL_SECONDS = 60 * 60 * 24;
const SCAN_ITERATIONS = 6;
const SCAN_COUNT = 250;
const TITLE_LIMIT = 40;
const SERIES_DAYS = 30;
const PAYLOAD_KEYS_MAX = 14;
const STRING_MAX = 140;
const UA_MAX = 220;

export const TELEMETRY_EVENTS = [
  "watch_start",
  "watch_stop",
  "watch_complete",
  "search",
  "surprise_pick",
  "row_click",
  "list_toggle",
  "season_switch",
  "drawer_open",
  "player_error",
  "api_error",
  "navigation",
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[number];

const EVENT_NAME_SET = new Set<string>(TELEMETRY_EVENTS);

export interface RequestContext {
  profile: ProfileId | null;
  ip: string;
  country: string;
  city: string;
  region: string;
  ua: string;
  referrer: string;
  path: string;
}

export interface TelemetryPayload {
  name: string;
  data: Record<string, unknown>;
}

export interface StoredEvent extends TelemetryPayload {
  at: number;
  profile: ProfileId | null;
  ip: string;
  ipHash: string;
  country: string;
  city: string;
  region: string;
  device: string;
  ua: string;
  referrer: string;
  path: string;
}

export type SecurityEventKind =
  | "login_success"
  | "login_failure"
  | "login_rate_limited"
  | "logout"
  | "admin_login_success"
  | "admin_login_failure"
  | "unauthorized_api";

export interface SecurityEvent {
  kind: SecurityEventKind;
  at: number;
  profile: ProfileId | null;
  ip: string;
  ipHash: string;
  country: string;
  city: string;
  device: string;
  ua: string;
  note: string;
}

export interface DeviceSession {
  id: string;
  device: string;
  ua: string;
  country: string;
  ip: string;
  firstSeen: number;
  lastSeen: number;
  visits: number;
}

const keys = {
  events: (profile: ProfileId) => `admin:${profile}:events`,
  rollup: (day: string) => `admin:rollup:${day}`,
  hour: (day: string, hour: string) => `admin:hour:${day}:${hour}`,
  title: (type: string, id: number) => `admin:title:${type}:${id}`,
  genre: (genreId: number) => `admin:genre:${genreId}`,
  security: () => "admin:security",
  sessions: () => "admin:sessions",
  loginFail: (ipHash: string) => `admin:loginfail:${ipHash}`,
};

export function dayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

function hourKey(at: number): string {
  return new Date(at).toISOString().slice(11, 13);
}

function ipSecret(): string {
  return (
    process.env.ADMIN_PASSWORD ||
    process.env.REDIS_URL ||
    "manaltv-telemetry"
  );
}

export function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";

  if (ip.includes(":")) {
    return `${ip.split(":").slice(0, 3).join(":")}::/48`;
  }

  const octets = ip.split(".");
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }

  return "unknown";
}

export function hashIp(ip: string): string {
  return createHmac("sha256", ipSecret()).update(ip).digest("hex").slice(0, 16);
}

export function deviceIdFor(ua: string): string {
  return createHash("sha256").update(ua).digest("hex").slice(0, 16);
}

export function describeDevice(ua: string): string {
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "Unknown browser";

  const platform = /windows/i.test(ua)
    ? "Windows"
    : /mac os|macintosh/i.test(ua)
      ? "macOS"
      : /android/i.test(ua)
        ? "Android"
        : /iphone|ipad|ios/i.test(ua)
          ? "iOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${platform}`;
}

export function contextFromRequest(request: Request): RequestContext {
  const headers = request.headers;
  const forwarded =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  const ua = (headers.get("user-agent") ?? "unknown").slice(0, UA_MAX);

  return {
    profile: null,
    ip: forwarded,
    country: headers.get("x-vercel-ip-country") ?? "",
    city: headers.get("x-vercel-ip-city") ?? "",
    region: headers.get("x-vercel-ip-country-region") ?? "",
    ua,
    referrer: (headers.get("referer") ?? "").slice(0, STRING_MAX),
    path: (headers.get("x-pathname") ?? "").slice(0, STRING_MAX),
  };
}

function decodeHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value).slice(0, STRING_MAX);
  } catch {
    return value.slice(0, STRING_MAX);
  }
}

function sanitizeData(
  input: unknown
): Record<string, string | number | boolean> {
  if (typeof input !== "object" || input === null) return {};

  const out: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= PAYLOAD_KEYS_MAX) break;
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "string" && value.trim().length > 0) {
      out[key] = value.trim().slice(0, STRING_MAX);
    }
  }

  return out;
}

function readNumber(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.slice(0, STRING_MAX) : "";
}

function readFlag(data: Record<string, unknown>, key: string): boolean {
  const value = data[key];
  return value === true || value === "true";
}

async function bumpRollups(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  name: TelemetryEventName,
  data: Record<string, string | number | boolean>,
  at: number
): Promise<void> {
  const day = dayKey(at);
  const rollupKey = keys.rollup(day);
  const fields: { field: string; amount: number; float: boolean }[] = [];

  const bump = (field: string, amount = 1, float = false) => {
    fields.push({ field, amount, float });
  };

  const seconds = readNumber(data, "seconds");

  if (name === "watch_stop") {
    bump("watch_stops");
    if (seconds > 0) bump("seconds_watched", seconds, true);
  } else if (name === "watch_start") {
    bump("watch_starts");
  } else if (name === "watch_complete") {
    bump("watch_completes");
  } else if (name === "search") {
    bump("searches");
  } else if (name === "surprise_pick") {
    bump("surprise_picks");
  } else if (name === "row_click") {
    bump("row_clicks");
  } else if (name === "list_toggle") {
    bump(readFlag(data, "added") ? "list_adds" : "list_removes");
  } else if (name === "season_switch") {
    bump("season_switches");
  } else if (name === "drawer_open") {
    bump("drawer_opens");
  } else if (name === "player_error") {
    bump("player_errors");
  } else if (name === "api_error") {
    bump("api_errors");
  } else if (name === "navigation") {
    bump("navigations");
  }

  if (fields.length === 0) return;

  const pipeline = redis.pipeline();

  for (const { field, amount, float } of fields) {
    if (float) {
      pipeline.hincrbyfloat(rollupKey, field, amount);
    } else {
      pipeline.hincrby(rollupKey, field, amount);
    }
  }

  pipeline.expire(rollupKey, ROLLUP_TTL_SECONDS);
  await pipeline.exec();

  if (seconds > 0) {
    const hourPipeline = redis.pipeline();
    hourPipeline.hincrbyfloat(keys.hour(day, hourKey(at)), "seconds", seconds);
    hourPipeline.expire(keys.hour(day, hourKey(at)), ROLLUP_TTL_SECONDS);
    await hourPipeline.exec();
  }
}

async function bumpTitles(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  name: TelemetryEventName,
  data: Record<string, string | number | boolean>,
  at: number
): Promise<void> {
  if (name !== "watch_start" && name !== "watch_stop" && name !== "watch_complete") {
    return;
  }

  const type = readString(data, "type");
  const tmdbId = readNumber(data, "tmdbId");
  if (!tmdbId || (type !== "movie" && type !== "tv")) return;

  const key = keys.title(type, tmdbId);
  const seconds = readNumber(data, "seconds");
  const pct = readNumber(data, "pct");
  const season = readNumber(data, "season");
  const episode = readNumber(data, "episode");
  const duration = readNumber(data, "duration");
  const pipeline = redis.pipeline();

  pipeline.hset(key, "type", type);
  pipeline.hset(key, "tmdbId", tmdbId);
  if (readString(data, "title")) pipeline.hset(key, "title", readString(data, "title"));
  if (season > 0) pipeline.hset(key, "season", season);
  if (episode > 0) pipeline.hset(key, "episode", episode);
  if (duration > 0) pipeline.hset(key, "duration", duration);

  if (name === "watch_start") {
    pipeline.hincrby(key, "plays", 1);
  }

  if (name === "watch_stop" && seconds > 0) {
    pipeline.hincrbyfloat(key, "seconds", seconds);
  }

  if (name === "watch_complete") {
    pipeline.hincrby(key, "completed", 1);
  }

  if (name === "watch_stop") {
    pipeline.hincrby(key, "stops", 1);
  }

  if (pct > 0) {
    pipeline.hset(key, "last_pct", pct);
    pipeline.hincrbyfloat(key, "pct_sum", pct);
    pipeline.hincrby(key, "pct_samples", 1);
  }

  const genres = readString(data, "genres");
  if (genres) {
    pipeline.hset(key, "genres", genres);
    if (seconds > 0) {
      for (const genreId of genres.split(",").slice(0, 6)) {
        const parsed = Number(genreId);
        if (Number.isFinite(parsed)) {
          pipeline.hincrbyfloat(keys.genre(parsed), "seconds", seconds);
          pipeline.hset(keys.genre(parsed), "name", readString(data, "genreNames"));
          pipeline.expire(keys.genre(parsed), ROLLUP_TTL_SECONDS);
        }
      }
    }
  }

  pipeline.hset(key, "last_at", at);
  pipeline.expire(key, ROLLUP_TTL_SECONDS);
  await pipeline.exec();
}

async function touchSession(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  context: RequestContext,
  at: number
): Promise<void> {
  const id = deviceIdFor(context.ua);
  const key = keys.sessions();
  const raw = await redis.hget(key, id);

  if (raw) {
    try {
      const existing = JSON.parse(raw) as DeviceSession;
      await redis.hset(
        key,
        id,
        JSON.stringify({
          ...existing,
          lastSeen: at,
          visits: existing.visits + 1,
          ip: maskIp(context.ip),
          country: context.country,
        })
      );
    } catch {
      await redis.hset(key, id, JSON.stringify(buildSession(id, context, at, 1)));
    }
  } else {
    await redis.hset(key, id, JSON.stringify(buildSession(id, context, at, 1)));
  }

  await redis.expire(key, SESSION_TTL_SECONDS);
}

function buildSession(
  id: string,
  context: RequestContext,
  at: number,
  visits: number
): DeviceSession {
  return {
    id,
    device: describeDevice(context.ua),
    ua: context.ua,
    country: context.country,
    ip: maskIp(context.ip),
    firstSeen: at,
    lastSeen: at,
    visits,
  };
}

export function isTelemetryEvent(value: unknown): value is TelemetryEventName {
  return typeof value === "string" && EVENT_NAME_SET.has(value);
}

export async function recordTelemetryEvent(
  context: RequestContext,
  name: TelemetryEventName,
  rawData: unknown,
  now = Date.now()
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const data = sanitizeData(rawData);
  const event: StoredEvent = {
    name,
    data,
    at: now,
    profile: context.profile,
    ip: maskIp(context.ip),
    ipHash: hashIp(context.ip),
    country: context.country,
    city: decodeHeaderValue(context.city),
    region: context.region,
    device: describeDevice(context.ua),
    ua: context.ua,
    referrer: context.referrer,
    path: context.path || readString(data, "path"),
  };

  try {
    if (context.profile) {
      const eventKey = keys.events(context.profile);
      const pipeline = redis.pipeline();
      pipeline.lpush(eventKey, JSON.stringify(event));
      pipeline.ltrim(eventKey, 0, EVENT_RING_MAX - 1);
      pipeline.expire(eventKey, EVENT_TTL_SECONDS);
      await pipeline.exec();

      await bumpRollups(redis, name, data, now);
      await bumpTitles(redis, name, data, now);
      await touchSession(redis, context, now);
    }
  } catch {
    // Telemetry must never break the request path.
  }
}

export async function recordSecurityEvent(
  context: RequestContext,
  kind: SecurityEventKind,
  note = "",
  now = Date.now()
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const event: SecurityEvent = {
    kind,
    at: now,
    profile: context.profile,
    ip: maskIp(context.ip),
    ipHash: hashIp(context.ip),
    country: context.country,
    city: decodeHeaderValue(context.city),
    device: describeDevice(context.ua),
    ua: context.ua,
    note: note.slice(0, STRING_MAX),
  };

  try {
    const key = keys.security();
    const pipeline = redis.pipeline();
    pipeline.lpush(key, JSON.stringify(event));
    pipeline.ltrim(key, 0, SECURITY_RING_MAX - 1);
    pipeline.expire(key, SECURITY_TTL_SECONDS);
    await pipeline.exec();
  } catch {
    // Ignore.
  }
}

export async function loginFailureCount(ipHash: string): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;

  try {
    const raw = await redis.get(keys.loginFail(ipHash));
    const parsed = Number(raw ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function registerLoginFailure(ipHash: string): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;

  try {
    const key = keys.loginFail(ipHash);
    const count = await redis.incr(key);
    await redis.expire(key, LOGIN_FAIL_TTL_SECONDS);
    return count;
  } catch {
    return 0;
  }
}

export async function clearLoginFailures(ipHash: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    await redis.del(keys.loginFail(ipHash));
  } catch {
    // Ignore.
  }
}

async function scanKeys(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  pattern: string
): Promise<string[]> {
  const found: string[] = [];
  let cursor = "0";

  try {
    for (let i = 0; i < SCAN_ITERATIONS; i += 1) {
      const [next, batch] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        SCAN_COUNT
      );
      cursor = next;
      found.push(...batch);
      if (cursor === "0") break;
    }
  } catch {
    return found;
  }

  return found;
}

function parseJsonArray<T>(raw: string[]): T[] {
  const out: T[] = [];

  for (const entry of raw) {
    try {
      out.push(JSON.parse(entry) as T);
    } catch {
      // Skip malformed.
    }
  }

  return out;
}

function hashNumber(hash: Record<string, string>, field: string): number {
  const parsed = Number(hash[field] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface TitleAggregate {
  key: string;
  type: string;
  tmdbId: number;
  title: string;
  plays: number;
  stops: number;
  completed: number;
  seconds: number;
  avgPct: number;
  lastPct: number;
  lastAt: number;
  genres: string;
  season: number;
  episode: number;
  duration: number;
}

export interface DayAggregate {
  date: string;
  seconds: number;
  watch_starts: number;
  watch_stops: number;
  watch_completes: number;
  searches: number;
  surprise_picks: number;
  list_adds: number;
  list_removes: number;
  row_clicks: number;
  player_errors: number;
  api_errors: number;
}

export interface AdminSnapshot {
  generatedAt: number;
  profiles: ProfileId[];
  kv: {
    configured: boolean;
    profiles: {
      id: ProfileId;
      name: string;
      bytes: number;
      historyCount: number;
      listCount: number;
      events: number;
    }[];
  };
  totals: Record<string, number>;
  series: DayAggregate[];
  hours: { hour: string; seconds: number }[];
  titles: TitleAggregate[];
  genres: { id: number; name: string; seconds: number }[];
  events: StoredEvent[];
  security: SecurityEvent[];
  sessions: DeviceSession[];
  system: {
    region: string;
    commit: string;
    runtime: string;
    envPresent: Record<string, boolean>;
    deploymentId: string;
  };
}

function emptyDay(date: string): DayAggregate {
  return {
    date,
    seconds: 0,
    watch_starts: 0,
    watch_stops: 0,
    watch_completes: 0,
    searches: 0,
    surprise_picks: 0,
    list_adds: 0,
    list_removes: 0,
    row_clicks: 0,
    player_errors: 0,
    api_errors: 0,
  };
}

export async function buildAdminSnapshot(): Promise<AdminSnapshot> {
  const redis = await getRedis();
  const profileIds = Object.keys(PROFILES) as ProfileId[];
  const generatedAt = Date.now();

  const system = {
    region: process.env.VERCEL_REGION ?? "",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    runtime: `node ${process.version}`,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? "",
    envPresent: {
      TMDB_API_KEY: Boolean(process.env.TMDB_API_KEY),
      REDIS_URL: Boolean(process.env.REDIS_URL),
      ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
    },
  };

  if (!redis) {
    return {
      generatedAt,
      profiles: profileIds,
      kv: { configured: kvConfigured, profiles: [] },
      totals: {},
      series: [],
      hours: [],
      titles: [],
      genres: [],
      events: [],
      security: [],
      sessions: [],
      system,
    };
  }

  const days: string[] = [];
  for (let i = SERIES_DAYS - 1; i >= 0; i -= 1) {
    days.push(dayKey(generatedAt - i * 86_400_000));
  }
  const today = days[days.length - 1] ?? dayKey(generatedAt);

  const [hours, eventRings, titleKeys, genreKeys, securityRaw, sessionsRaw] =
    await Promise.all([
      Promise.all(
        Array.from({ length: 24 }, (_, hour) =>
          redis.hgetall(keys.hour(today, String(hour).padStart(2, "0")))
        )
      ),
      Promise.all(
        profileIds.map((id) => redis.lrange(keys.events(id), 0, 199))
      ),
      scanKeys(redis, "admin:title:*"),
      scanKeys(redis, "admin:genre:*"),
      redis.lrange(keys.security(), 0, 99),
      redis.hgetall(keys.sessions()),
    ]);

  const series: DayAggregate[] = days.map((date) => emptyDay(date));
  const totals: Record<string, number> = {};

  const dayHashes = await Promise.all(
    days.map((date) => redis.hgetall(keys.rollup(date)))
  );

  for (const [index, hash] of dayHashes.entries()) {
    const bucket = series[index];
    if (!bucket) continue;

    bucket.seconds = hashNumber(hash, "seconds_watched");
    bucket.watch_starts = hashNumber(hash, "watch_starts");
    bucket.watch_stops = hashNumber(hash, "watch_stops");
    bucket.watch_completes = hashNumber(hash, "watch_completes");
    bucket.searches = hashNumber(hash, "searches");
    bucket.surprise_picks = hashNumber(hash, "surprise_picks");
    bucket.list_adds = hashNumber(hash, "list_adds");
    bucket.list_removes = hashNumber(hash, "list_removes");
    bucket.row_clicks = hashNumber(hash, "row_clicks");
    bucket.player_errors = hashNumber(hash, "player_errors");
    bucket.api_errors = hashNumber(hash, "api_errors");

    for (const [field, value] of Object.entries(bucket)) {
      if (field === "date") continue;
      totals[field] = (totals[field] ?? 0) + value;
    }
  }

  const hourBuckets = hours.map((hash, hour) => ({
    hour: String(hour).padStart(2, "0"),
    seconds: hashNumber(hash, "seconds"),
  }));

  const titleHashes = await Promise.all(
    titleKeys.slice(0, TITLE_LIMIT * 3).map((key) => redis.hgetall(key))
  );

  const titles: TitleAggregate[] = titleHashes
    .map((hash, index): TitleAggregate | null => {
      const key = titleKeys[index];
      if (!key) return null;

      const tmdbId = Number(key.split(":").pop());
      const pctSamples = hashNumber(hash, "pct_samples");

      return {
        key,
        type: hash.type ?? "",
        tmdbId,
        title: hash.title ?? `${hash.type ?? "media"} ${tmdbId}`,
        plays: hashNumber(hash, "plays"),
        stops: hashNumber(hash, "stops"),
        completed: hashNumber(hash, "completed"),
        seconds: hashNumber(hash, "seconds"),
        avgPct: pctSamples > 0 ? Math.round(hashNumber(hash, "pct_sum") / pctSamples) : 0,
        lastPct: hashNumber(hash, "last_pct"),
        lastAt: hashNumber(hash, "last_at"),
        genres: hash.genres ?? "",
        season: hashNumber(hash, "season"),
        episode: hashNumber(hash, "episode"),
        duration: hashNumber(hash, "duration"),
      };
    })
    .filter((entry): entry is TitleAggregate => entry !== null)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, TITLE_LIMIT);

  const genreHashes = await Promise.all(
    genreKeys.map((key) => redis.hgetall(key))
  );

  const genres = genreHashes
    .map((hash, index) => ({
      id: Number(genreKeys[index]?.split(":").pop()) || 0,
      name: hash.name || `genre ${genreKeys[index]?.split(":").pop()}`,
      seconds: hashNumber(hash, "seconds"),
    }))
    .filter((genre) => genre.id > 0)
    .sort((a, b) => b.seconds - a.seconds);

  const events = eventRings.flatMap((ring) => parseJsonArray<StoredEvent>(ring))
    .sort((a, b) => b.at - a.at)
    .slice(0, 150);

  const security = parseJsonArray<SecurityEvent>(securityRaw).sort(
    (a, b) => b.at - a.at
  );

  const sessions = Object.values(sessionsRaw)
    .map((raw) => {
      try {
        return JSON.parse(raw) as DeviceSession;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is DeviceSession => entry !== null)
    .sort((a, b) => b.lastSeen - a.lastSeen);

  const profileStats = await Promise.all(
    profileIds.map(async (id) => {
      const [data, bytes, eventCount] = await Promise.all([
        readUserData(id),
        redis.strlen(dataKeyForProfile(id)),
        redis.llen(keys.events(id)),
      ]);

      return {
        id,
        name: PROFILES[id].name,
        bytes,
        historyCount: data.watchHistory.length,
        listCount: data.myList.length,
        events: eventCount,
      };
    })
  );

  return {
    generatedAt,
    profiles: profileIds,
    kv: { configured: kvConfigured, profiles: profileStats },
    totals,
    series,
    hours: hourBuckets,
    titles,
    genres,
    events,
    security,
    sessions,
    system,
  };
}