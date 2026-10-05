import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "manaltv_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;
export const ADMIN_LOGIN_MAX_ATTEMPTS = 8;

const SECRET = process.env.ADMIN_PASSWORD || "manaltv-admin-dev";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

function digest(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function adminPasswordMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) return false;

  return timingSafeEqual(digest(candidate), digest(expected));
}

export function createAdminToken(): string {
  const issuedAt = Date.now().toString(36);
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;

  const [issuedAt, signature] = token.split(".");

  if (!issuedAt || !signature) return false;

  const expected = sign(issuedAt);
  const provided = Buffer.from(signature, "utf8");

  if (provided.length !== expected.length) return false;

  if (!timingSafeEqual(provided, Buffer.from(expected, "utf8"))) return false;

  const age = Date.now() - Number.parseInt(issuedAt, 36);
  return Number.isFinite(age) && age > 0 && age < ADMIN_COOKIE_MAX_AGE * 1000;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);
}

export async function setAdminCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}