import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "streamminimal-api",
    tmdbKeyConfigured: Boolean(process.env.TMDB_API_KEY),
    timestamp: Date.now(),
  });
}