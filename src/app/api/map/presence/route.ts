import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { featureFlags } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

const GEOHASH_5_RE = /^[0123456789bcdefghjkmnpqrstuvwxyz]{5}$/;
const EVENT_TYPES = new Set(["active", "node_hosting"]);

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    if (!featureFlags.heatmapV2Enabled) {
      return NextResponse.json({ error: "Heatmap v2 is disabled" }, { status: 404 });
    }

    try {
      const body = await request.json();
      const geohash5 = String(body?.geohash_5 || "").toLowerCase();
      const eventType = String(body?.event_type || "");

      if (!GEOHASH_5_RE.test(geohash5)) {
        return NextResponse.json({ error: "geohash_5 must be a valid 5-char geohash" }, { status: 400 });
      }
      if (!EVENT_TYPES.has(eventType)) {
        return NextResponse.json({ error: "event_type must be active or node_hosting" }, { status: 400 });
      }

      const service = createServiceClient();
      const { error } = await service.from("presence_events").insert({
        geohash_5: geohash5,
        event_type: eventType,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  });
}
