import { NextResponse } from "next/server";
import { featureFlags, runtimeConfig } from "@/lib/env";
import { getRequestUser } from "@/lib/api/request-user";
import { createServiceClient } from "@/lib/supabase/server";
import { mapCellScopeKey, userScopeKey } from "@/lib/sync/scope-keys";

export async function GET(request: Request) {
  if (!featureFlags.syncV2Enabled) {
    return NextResponse.json({ error: "Sync v2 is disabled" }, { status: 404 });
  }

  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: memberships } = await service
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(200);

  const scopes = [
    userScopeKey(user.id),
    ...(memberships || []).map((row) => `group:${row.group_id}`),
    mapCellScopeKey("r"),
  ];

  return NextResponse.json({
    protocol: runtimeConfig.protocolVersion,
    features: [
      "sync.pull",
      "sync.checkpoints",
      ...(featureFlags.localFirstEnabled ? ["local-first.web"] : []),
      ...(featureFlags.heatmapV2Enabled ? ["presence.heatmap.v2"] : []),
    ],
    scopes,
  });
}
