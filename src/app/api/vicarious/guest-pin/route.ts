import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServiceClient } from "@/lib/supabase/server";
import { GUEST_DESCRIPTION_MAX, GUEST_NAME_MAX } from "@/plugins/vicarious/constants";

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    try {
      const body = await request.json();
      const sessionCode = String(body.session_code || "").trim().toLowerCase();
      const guestName = String(body.guest_name || "").trim();
      const description = String(body.description || "").trim();
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);

      if (!sessionCode) {
        return NextResponse.json({ error: "session_code is required" }, { status: 400 });
      }
      if (!guestName || guestName.length > GUEST_NAME_MAX) {
        return NextResponse.json({ error: `guest_name must be 1-${GUEST_NAME_MAX} chars` }, { status: 400 });
      }
      if (!description || description.length > GUEST_DESCRIPTION_MAX) {
        return NextResponse.json({ error: `description must be 1-${GUEST_DESCRIPTION_MAX} chars` }, { status: 400 });
      }
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
      }

      const service = createServiceClient();
      const { data: session } = await service
        .from("vicarious_sessions")
        .select("id, group_id, is_active")
        .eq("session_code", sessionCode)
        .maybeSingle();

      if (!session || !session.is_active) {
        return NextResponse.json({ error: "No active session found" }, { status: 404 });
      }

      const { data: pin, error } = await service
        .from("pins")
        .insert({
          author_name: guestName,
          guest_name: guestName,
          description,
          latitude,
          longitude,
          group_id: session.group_id,
          vicarious_session_id: session.id,
          status: "pending",
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(pin, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  });
}
