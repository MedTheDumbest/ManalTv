import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getRedis } from "@/lib/kv";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const redis = await getRedis();

  if (!redis) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const purged: string[] = [];
  let cursor = "0";

  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", "admin:*", "COUNT", 300);
    cursor = next;

    if (batch.length > 0) {
      await redis.del(...batch);
      purged.push(...batch);
    }
  } while (cursor !== "0");

  return NextResponse.json(
    { ok: true, purged: purged.length },
    { headers: NO_STORE_HEADERS }
  );
}