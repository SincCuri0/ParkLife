import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { LOCATION_FUZZ_METRES, PIN_EXPIRY_DAYS } from "@/lib/constants";
import { createNotification } from "@/lib/notifications";
import { PinCategory } from "@/lib/types";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { emitCrdtOperation } from "@/lib/sync/crdt-emitter";
import { adaptedWrite } from "@/lib/sync/write-adapter";
import { mapCellScopeKey, userScopeKey } from "@/lib/sync/scope-keys";

const GROUP_CATEGORIES: PinCategory[] = ["event", "help", "item", "announcement", "hangout"];

function calculateExpiry(category: PinCategory, eventDate?: string) {
  if (category === "event") {
    const baseDate = eventDate ? new Date(eventDate) : new Date();
    if (Number.isNaN(baseDate.getTime())) return null;
    return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  const days = PIN_EXPIRY_DAYS[category];
  if (!days) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function fuzzLocation(lat: number, lng: number, precision: string) {
  const metres = LOCATION_FUZZ_METRES[precision] ?? LOCATION_FUZZ_METRES.suburb;
  const latOffset = (Math.random() - 0.5) * 2 * (metres / 111320);
  const lngOffset = (Math.random() - 0.5) * 2 * (metres / (111320 * Math.cos((lat * Math.PI) / 180)));
  return {
    latitude: lat + latOffset,
    longitude: lng + lngOffset,
  };
}

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    try {
      const body = await request.json();
      const {
        author_name,
        description,
        latitude,
        longitude,
        session_id,
        group_id,
        category,
        title,
        event_date,
      } = body;
      const isGroupPin = Boolean(group_id);
      const normalizedSessionId = session_id ? String(session_id).trim().toLowerCase() : "";
      const isSessionPin = !isGroupPin && Boolean(normalizedSessionId);

      if (!isGroupPin && !description) {
        return NextResponse.json({ error: "Description is required" }, { status: 400 });
      }

      const trimmedDescription = description ? String(description).trim() : null;
      if (trimmedDescription && trimmedDescription.length > 280) {
        return NextResponse.json({ error: "Description must be 280 characters or less" }, { status: 400 });
      }

      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
      }

      const supabase = createServiceClient();

      if (isSessionPin) {
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("id, is_active")
          .eq("id", normalizedSessionId)
          .single();

        if (sessionError || !session || !session.is_active) {
          return NextResponse.json({ error: "Session is not active" }, { status: 400 });
        }
      }

      let postedBy: string | null = null;
      let normalizedCategory: PinCategory | null = null;
      let expiresAt: string | null = null;
      let normalizedTitle: string | null = null;
      let insertLatitude = latitude;
      let insertLongitude = longitude;

      if (isGroupPin || !isSessionPin) {
        const authClient = await createServerClient();
        const {
          data: { user },
        } = await authClient.auth.getUser();

        if (!user) {
          return NextResponse.json({ error: "Authentication required or provide a session_id for guest pins" }, { status: 401 });
        }

        postedBy = user.id;

        if (isGroupPin) {
          if (!category || !GROUP_CATEGORIES.includes(category)) {
            return NextResponse.json({ error: "Invalid category" }, { status: 400 });
          }

          normalizedTitle = title ? String(title).trim() : "";
          if (!normalizedTitle || normalizedTitle.length > 100) {
            return NextResponse.json({ error: "Title is required and must be 100 characters or less" }, { status: 400 });
          }

          const { data: membership } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("group_id", String(group_id))
            .eq("user_id", user.id)
            .maybeSingle();

          if (!membership) {
            return NextResponse.json({ error: "You must be a group member to post" }, { status: 403 });
          }

          normalizedCategory = category as PinCategory;
          expiresAt = calculateExpiry(normalizedCategory, event_date ? String(event_date) : undefined);
        }

        const { data: poster } = await supabase
          .from("profiles")
          .select("location_precision")
          .eq("id", user.id)
          .maybeSingle();

        const fuzzed = fuzzLocation(latitude, longitude, poster?.location_precision || "suburb");
        insertLatitude = fuzzed.latitude;
        insertLongitude = fuzzed.longitude;
      }

      const { data, error } = await adaptedWrite(
        async () => supabase
          .from("pins")
          .insert({
            author_name: String(author_name || "Member").trim(),
            description: trimmedDescription,
            latitude: insertLatitude,
            longitude: insertLongitude,
            session_id: isSessionPin ? normalizedSessionId : null,
            group_id: isGroupPin ? String(group_id) : null,
            category: normalizedCategory,
            title: normalizedTitle,
            expires_at: expiresAt,
            posted_by: postedBy,
            status: "pending",
          })
          .select("*")
          .single(),
        async (result) => {
          if (!result.data) return;
          const scopeKey = result.data.group_id
            ? `group:${result.data.group_id}`
            : result.data.posted_by
              ? userScopeKey(result.data.posted_by)
              : mapCellScopeKey("r");
          await emitCrdtOperation({
            scopeKey,
            documentType: "pins",
            entityType: "pin",
            entityId: result.data.id,
            action: "create",
            payload: result.data,
          });
        },
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (isGroupPin && postedBy && data?.group_id) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("group_id", data.group_id)
          .eq("type", "new_group_pin")
          .gte("created_at", oneHourAgo)
          .limit(1);

        if (!recentNotification?.length) {
          const { data: members } = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", data.group_id)
            .neq("user_id", postedBy);

          for (const member of members || []) {
            await createNotification({
              user_id: member.user_id,
              type: "new_group_pin",
              actor_id: postedBy,
              pin_id: data.id,
              group_id: data.group_id,
            });
          }
        }
      }

      return NextResponse.json(data, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  });
}
