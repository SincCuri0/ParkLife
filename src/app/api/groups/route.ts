import { customAlphabet } from "nanoid";
import { NextResponse } from "next/server";
import { GROUP_COLOURS } from "@/lib/constants";
import { createAnonServerClient, createServerClient, createServiceClient } from "@/lib/supabase/server";

const makeInviteCode = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const limitValue = Number(url.searchParams.get("limit") || "40");
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(limitValue, 100)) : 40;

  const supabase = createAnonServerClient();
  let groupsQuery = supabase
    .from("groups")
    .select("id, created_at, name, description, location_label, latitude, longitude, radius_km, colour, invite_code, is_public, is_virtual, requires_approval, created_by")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (query) {
    groupsQuery = groupsQuery.or(`name.ilike.%${query}%,location_label.ilike.%${query}%`);
  }

  const { data, error } = await groupsQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  try {
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const description = body?.description ? String(body.description).trim() : null;
    const locationLabel = String(body?.location_label || "").trim();
    const latitude = body?.latitude === null ? null : Number(body?.latitude);
    const longitude = body?.longitude === null ? null : Number(body?.longitude);
    const isPublic = body?.is_public !== false;
    const isVirtual = Boolean(body?.is_virtual);
    const requiresApproval = Boolean(body?.requires_approval);

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Group name must be between 2 and 80 characters" }, { status: 400 });
    }
    if (description && description.length > 280) {
      return NextResponse.json({ error: "Description must be 280 characters or less" }, { status: 400 });
    }
    if (!locationLabel) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    if (!isVirtual && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    const service = createServiceClient();
    const [{ count }, { data: profile }] = await Promise.all([
      service.from("groups").select("*", { count: "exact", head: true }),
      service.from("profiles").select("id").eq("id", user.id).maybeSingle(),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "Please complete your profile setup first" }, { status: 400 });
    }

    const colour = GROUP_COLOURS[(count || 0) % GROUP_COLOURS.length];
    let inviteCode = makeInviteCode();

    for (let i = 0; i < 5; i += 1) {
      const { data: existing } = await service
        .from("groups")
        .select("id")
        .eq("invite_code", inviteCode)
        .maybeSingle();
      if (!existing) {
        break;
      }
      inviteCode = makeInviteCode();
    }

    const { data: group, error: groupError } = await service
      .from("groups")
      .insert({
        name,
        description,
        location_label: locationLabel,
        latitude: isVirtual ? null : latitude,
        longitude: isVirtual ? null : longitude,
        colour,
        invite_code: inviteCode,
        is_public: isPublic,
        is_virtual: isVirtual,
        requires_approval: isPublic ? false : requiresApproval,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (groupError || !group) {
      return NextResponse.json({ error: groupError?.message || "Could not create group" }, { status: 500 });
    }

    const { error: memberError } = await service
      .from("group_members")
      .insert({ group_id: group.id, user_id: user.id, role: "admin" });

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({ group, invite_code: group.invite_code }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
