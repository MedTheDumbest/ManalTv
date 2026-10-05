import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACTIVE_PROFILE_COOKIE, isProfileId } from "@/lib/accounts";
import {
  contextFromRequest,
  isTelemetryEvent,
  recordTelemetryEvent,
  recordSecurityEvent,
} from "@/lib/telemetry-server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const MAX_BODY_BYTES = 8_192;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const profile = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;
  const context = contextFromRequest(request);

  if (!isProfileId(profile)) {
    context.profile = null;
    await recordSecurityEvent(context, "unauthorized_api", "/api/telemetry");
    return json({ ok: false }, 401);
  }

  context.profile = profile;

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false }, 413);
  }

  const raw = await request.text();

  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false }, 413);
  }

  let body: { name?: unknown; data?: unknown } | null = null;

  try {
    body = JSON.parse(raw) as { name?: unknown; data?: unknown };
  } catch {
    return json({ ok: false }, 400);
  }

  if (!isTelemetryEvent(body?.name)) {
    return json({ ok: false }, 400);
  }

  await recordTelemetryEvent(context, body.name, body.data);

  return json({ ok: true });
}