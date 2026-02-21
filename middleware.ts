import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/host/")) {
    if (request.nextUrl.pathname === "/host" || request.nextUrl.pathname === "/host/create") {
      return NextResponse.next();
    }

    const isAuthenticated = request.cookies.get("host_authenticated")?.value === "true";
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/host", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/host/:path*"],
};
