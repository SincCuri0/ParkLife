import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

const DEFAULT_NOTIFICATION_PREFS = {
  comment_on_pin: { inapp: true, push: false },
  reply_to_comment: { inapp: true, push: false },
  co_comment: { inapp: true, push: false },
  new_group_pin: { inapp: true, push: false },
  group_join: { inapp: true, push: false },
  pin_activated: { inapp: true, push: false },
};

const DEFAULT_AI_DATA_SHARING = {
  location: false,
  group_memberships: false,
  pin_history: false,
  activity_patterns: false,
  calendar: false,
};

export async function GET() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("profile_visibility, show_pin_history, location_precision, notification_prefs, ai_data_sharing, lamp_visibility_enabled")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile_visibility: data?.profile_visibility || "public",
    show_pin_history: data?.show_pin_history ?? true,
    location_precision: data?.location_precision || "suburb",
    notification_prefs: data?.notification_prefs || DEFAULT_NOTIFICATION_PREFS,
    ai_data_sharing: data?.ai_data_sharing || DEFAULT_AI_DATA_SHARING,
    lamp_visibility_enabled: data?.lamp_visibility_enabled || false,
  });
}

export async function PATCH(request: Request) {
  return withIdempotency(request, async () => {
    try {
      const authClient = await createServerClient();
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const body = await request.json();
      const updates: Record<string, unknown> = {};

      if (body.profile_visibility === "public" || body.profile_visibility === "members") {
        updates.profile_visibility = body.profile_visibility;
      }

      if (typeof body.show_pin_history === "boolean") {
        updates.show_pin_history = body.show_pin_history;
      }

      if (
        body.location_precision === "neighbourhood" ||
        body.location_precision === "suburb" ||
        body.location_precision === "city"
      ) {
        updates.location_precision = body.location_precision;
      }

      if (body.notification_prefs && typeof body.notification_prefs === "object") {
        updates.notification_prefs = body.notification_prefs;
      }

      if (body.ai_data_sharing && typeof body.ai_data_sharing === "object") {
        updates.ai_data_sharing = {
          ...DEFAULT_AI_DATA_SHARING,
          ...body.ai_data_sharing,
        };
      }

      if (typeof body.lamp_visibility_enabled === "boolean") {
        updates.lamp_visibility_enabled = body.lamp_visibility_enabled;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const service = createServiceClient();
      const { error } = await service
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  });
}
