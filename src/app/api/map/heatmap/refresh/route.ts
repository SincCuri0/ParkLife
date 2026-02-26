import { NextResponse } from "next/server";
import { featureFlags, runtimeConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

function isAuthorizedRefreshRequest(request: Request) {
  const configuredToken = runtimeConfig.heatmapRefreshToken;
  if (!configuredToken) {
    return false;
  }

  const headerToken = request.headers.get("x-heatmap-refresh-token")?.trim() || "";
  const authHeader = request.headers.get("authorization")?.trim() || "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : "";

  return headerToken === configuredToken || bearerToken === configuredToken;
}

export async function POST(request: Request) {
  if (!featureFlags.heatmapV2Enabled) {
    return NextResponse.json({ error: "Heatmap v2 is disabled" }, { status: 404 });
  }

  if (!runtimeConfig.heatmapRefreshToken) {
    return NextResponse.json({ error: "Heatmap refresh token is not configured" }, { status: 503 });
  }

  if (!isAuthorizedRefreshRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { error } = await service.rpc("refresh_heatmap_cells_5m");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    refreshed_at: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return POST(request);
}
