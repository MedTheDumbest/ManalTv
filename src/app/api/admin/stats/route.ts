import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { buildAdminSnapshot } from "@/lib/telemetry-server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const snapshot = await buildAdminSnapshot();

  return NextResponse.json(snapshot, { headers: NO_STORE_HEADERS });
}