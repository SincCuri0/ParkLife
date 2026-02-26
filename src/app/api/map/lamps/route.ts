import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { featureFlags } from "@/lib/env";
import { parseBbox } from "@/lib/map/geohash";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

type LampProfileSettings = {
  lamp_visibility_enabled?: boolean;
  ai_data_sharing?: { location?: boolean };
} | null;

function hasLampLocationConsent(profile: LampProfileSettings) {
  return profile?.lamp_visibility_enabled === true
    && profile?.ai_data_sharing?.location === true;
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export async function GET(request: Request) {
  if (!featureFlags.heatmapV2Enabled) {
    return NextResponse.json({ error: "Heatmap v2 is disabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const bbox = parseBbox(url.searchParams.get("bbox"));
  const service = createServiceClient();
  let query = service
    .from("lamp_presence")
    .select("user_id, latitude, longitude, updated_at, profile:profiles!inner(lamp_visibility_enabled, ai_data_sharing)")
    .order("updated_at", { ascending: false });

  if (bbox) {
    query = query
      .gte("latitude", bbox.minLat)
      .lte("latitude", bbox.maxLat)
      .gte("longitude", bbox.minLng)
      .lte("longitude", bbox.maxLng);
  }

  const { data, error } = await query.limit(300);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const visibleSince = Date.now() - 60_000;
  const lamps = (data || [])
    .filter((row) => {
      const profile = row.profile as { lamp_visibility_enabled?: boolean; ai_data_sharing?: { location?: boolean } } | null;
      const hasConsent = profile?.lamp_visibility_enabled && profile?.ai_data_sharing?.location === true;
      if (!hasConsent) return false;
      return new Date(row.updated_at).getTime() >= visibleSince;
    })
    .map((row) => ({
      user_id: row.user_id,
      latitude: row.latitude,
      longitude: row.longitude,
      updated_at: row.updated_at,
    }));

  return NextResponse.json(
    { lamps },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    if (!featureFlags.heatmapV2Enabled) {
      return NextResponse.json({ error: "Heatmap v2 is disabled" }, { status: 404 });
    }

    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = body as { latitude?: unknown; longitude?: unknown };
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return NextResponse.json({ error: "latitude/longitude are required and must be valid coordinates" }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("lamp_visibility_enabled, ai_data_sharing")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!hasLampLocationConsent(profile as LampProfileSettings)) {
      await service.from("lamp_presence").delete().eq("user_id", user.id);
      return NextResponse.json(
        { error: "Enable lamp visibility and location sharing before publishing lamp presence" },
        { status: 403 },
      );
    }

    const updatedAt = new Date().toISOString();
    const { error } = await service.from("lamp_presence").upsert(
      {
        user_id: user.id,
        latitude,
        longitude,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated_at: updatedAt });
  });
}

export async function DELETE(request: Request) {
  return withIdempotency(request, async () => {
    if (!featureFlags.heatmapV2Enabled) {
      return NextResponse.json({ error: "Heatmap v2 is disabled" }, { status: 404 });
    }

    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const service = createServiceClient();
    const { error } = await service
      .from("lamp_presence")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
