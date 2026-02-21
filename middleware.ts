import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const platformProtected = ["/map", "/groups/create", "/profile/settings", "/notifications"];
  if (platformProtected.some((route) => path.startsWith(route))) {
    const hasSession =
      request.cookies.has("sb-access-token") ||
      request.cookies.has("sb-refresh-token") ||
      request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
    if (!hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (path.startsWith("/vicarious/host/")) {
    const isHost = request.cookies.get("vicarious_host")?.value === "true";
    if (!isHost) {
      return NextResponse.redirect(new URL("/vicarious", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/map",
    "/groups/create",
    "/profile/settings",
    "/notifications",
    "/vicarious/host/:path+",
  ],
};
