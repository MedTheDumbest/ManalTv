import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACTIVE_PROFILE_COOKIE, isProfileId } from "@/lib/accounts";

export function proxy(request: NextRequest) {
  const profile = request.cookies.get(ACTIVE_PROFILE_COOKIE)?.value;

  if (isProfileId(profile)) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};