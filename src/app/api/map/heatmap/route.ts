import { NextResponse } from "next/server";
import { featureFlags, runtimeConfig } from "@/lib/env";
import { isGeohashInBbox, parseBbox } from "@/lib/map/geohash";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!featureFlags.heatmapV2Enabled) {
    return NextResponse.json({ error: "Heatmap v2 is disabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const zoom = Number(url.searchParams.get("zoom") || "0");
  const requestedWindow = url.searchParams.get("window") || "30m";
  const bbox = parseBbox(url.searchParams.get("bbox"));

  const service = createServiceClient();
  const { data, error } = await service
    .from("heatmap_cells_5m")
    .select("geohash_5, activity_count, last_active")
    .gte("activity_count", runtimeConfig.heatmapKAnonymityThreshold)
    .order("activity_count", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filteredRows = bbox
    ? (data || []).filter((cell) => isGeohashInBbox(cell.geohash_5, bbox))
    : (data || []);
  const maxActivity = Math.max(1, ...filteredRows.map((cell) => Number(cell.activity_count || 0)));
  const cells = filteredRows.map((cell) => ({
    geohash: cell.geohash_5,
    intensity: Number(cell.activity_count || 0) / maxActivity,
    type: "ambient" as const,
    last_active: cell.last_active,
  }));

  return NextResponse.json(
    {
      cells,
      meta: {
        threshold: runtimeConfig.heatmapKAnonymityThreshold,
        zoom,
        window: requestedWindow,
        bbox: bbox
          ? `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`
          : null,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
