import { NextResponse } from "next/server";
import {
  ADMIN_LOGIN_MAX_ATTEMPTS,
  adminPasswordConfigured,
  adminPasswordMatches,
  clearAdminCookie,
  createAdminToken,
  setAdminCookie,
} from "@/lib/admin-auth";
import {
  clearLoginFailures,
  contextFromRequest,
  hashIp,
  loginFailureCount,
  recordSecurityEvent,
  registerLoginFailure,
} from "@/lib/telemetry-server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const MAX_BODY_BYTES = 1_024;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!adminPasswordConfigured()) {
    return json({ ok: false, error: "Admin access is not configured" }, 503);
  }

  const context = contextFromRequest(request);
  const ipHash = hashIp(context.ip);
  const attempts = await loginFailureCount(ipHash);

  if (attempts >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    await recordSecurityEvent(context, "login_rate_limited", "admin");
    return json({ ok: false, error: "Too many attempts" }, 429);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false }, 413);
  }

  let password = "";

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ ok: false }, 413);
    const body = JSON.parse(raw) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return json({ ok: false }, 400);
  }

  if (!adminPasswordMatches(password)) {
    const count = await registerLoginFailure(ipHash);
    await recordSecurityEvent(
      context,
      "login_failure",
      `admin attempt ${count}/${ADMIN_LOGIN_MAX_ATTEMPTS}`
    );

    return json(
      { ok: false, error: "Incorrect password", remaining: Math.max(0, ADMIN_LOGIN_MAX_ATTEMPTS - count) },
      401
    );
  }

  await clearLoginFailures(ipHash);
  await setAdminCookie(createAdminToken());
  await recordSecurityEvent(context, "admin_login_success", "admin");

  return json({ ok: true });
}

export async function DELETE() {
  await clearAdminCookie();
  return json({ ok: true });
}

export async function GET() {
  const response = json({
    configured: adminPasswordConfigured(),
    attemptsRemaining: ADMIN_LOGIN_MAX_ATTEMPTS,
  });
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"] ?? "no-store");
  return response;
}