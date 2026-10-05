import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACTIVE_PROFILE_COOKIE,
  PROFILES,
  isProfileId,
  verifyPin,
} from "@/lib/accounts";
import type { ProfileId } from "@/lib/accounts";
import {
  contextFromRequest,
  recordSecurityEvent,
} from "@/lib/telemetry-server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

function profilePayload(profileId: ProfileId) {
  const profile = PROFILES[profileId];
  return { id: profileId, name: profile.name };
}

export async function GET() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;

  if (!isProfileId(value)) {
    return json({ authenticated: false, profile: null });
  }

  return json({
    authenticated: true,
    profile: profilePayload(value),
  });
}

export async function POST(request: Request) {
  const context = contextFromRequest(request);

  const body = (await request.json().catch(() => null)) as
    | { profile?: unknown; pin?: unknown }
    | null;

  const profile = body?.profile;
  const pin = body?.pin;

  if (!isProfileId(profile) || typeof pin !== "string") {
    return json(
      { ok: false, error: "Invalid request" },
      400
    );
  }

  if (!verifyPin(profile, pin)) {
    context.profile = profile;
    await recordSecurityEvent(context, "login_failure", `profile ${profile}`);
    return json(
      { ok: false, error: "Incorrect PIN" },
      401
    );
  }

  context.profile = profile;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profile, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  await recordSecurityEvent(context, "login_success", `profile ${profile}`);

  return json({
    ok: true,
    profile: profilePayload(profile),
  });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, "", {
    maxAge: 0,
    path: "/",
  });
  cookieStore.delete(ACTIVE_PROFILE_COOKIE);

  await recordSecurityEvent(
    contextFromRequest(request),
    "logout",
    "profile cleared"
  );

  return json({ ok: true });
}