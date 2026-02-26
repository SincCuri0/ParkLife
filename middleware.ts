import { NextRequest, NextResponse } from "next/server";
import { CORRELATION_HEADER, ensureCorrelationId, structuredLog } from "@/lib/api/observability";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const correlationId = ensureCorrelationId(requestHeaders);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set(CORRELATION_HEADER, correlationId);

  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    structuredLog("info", {
      event: "api.request",
      correlationId,
      method: request.method,
      path,
      query: request.nextUrl.search,
      ip: request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
    });
  }

  const platformProtected = ["/map", "/groups/create", "/profile/settings", "/notifications"];
  if (platformProtected.some((route) => path.startsWith(route))) {
    const hasSession =
      request.cookies.has("sb-access-token") ||
      request.cookies.has("sb-refresh-token") ||
      request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
    if (!hasSession) {
      const redirect = NextResponse.redirect(new URL("/", request.url));
      redirect.headers.set(CORRELATION_HEADER, correlationId);
      return redirect;
    }
  }

  if (path.startsWith("/vicarious/host/")) {
    const isHost = request.cookies.get("vicarious_host")?.value === "true";
    if (!isHost) {
      const redirect = NextResponse.redirect(new URL("/vicarious", request.url));
      redirect.headers.set(CORRELATION_HEADER, correlationId);
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/map",
    "/groups/create",
    "/profile/settings",
    "/notifications",
    "/vicarious/host/:path+",
  ],
};
