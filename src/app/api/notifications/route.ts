import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const service = createServiceClient();
  const [{ data: notifications, error }, { count: unreadCount }] = await Promise.all([
    service
      .from("notifications")
      .select("id, created_at, user_id, type, actor_id, pin_id, comment_id, group_id, is_read")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    service
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = notifications || [];
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id).filter(Boolean))) as string[];
  const groupIds = Array.from(new Set(rows.map((row) => row.group_id).filter(Boolean))) as string[];
  const pinIds = Array.from(new Set(rows.map((row) => row.pin_id).filter(Boolean))) as string[];

  const [actorsResult, groupsResult, pinsResult] = await Promise.all([
    actorIds.length
      ? service.from("profiles").select("id, display_name, avatar_colour").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? service.from("groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [], error: null }),
    pinIds.length
      ? service.from("pins").select("id, title").in("id", pinIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const actorById = new Map((actorsResult.data || []).map((item) => [item.id, item]));
  const groupById = new Map((groupsResult.data || []).map((item) => [item.id, item]));
  const pinById = new Map((pinsResult.data || []).map((item) => [item.id, item]));

  const hydrated = rows.map((row) => ({
    ...row,
    actor: row.actor_id ? actorById.get(row.actor_id) || null : null,
    group: row.group_id ? groupById.get(row.group_id) || null : null,
    pin: row.pin_id ? pinById.get(row.pin_id) || null : null,
  }));

  return NextResponse.json({ notifications: hydrated, unread_count: unreadCount || 0 });
}
