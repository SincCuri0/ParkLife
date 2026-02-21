import { NextResponse } from "next/server";
import { createAnonServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAnonServerClient();

  const { data: group, error } = await supabase
    .from("groups")
    .select("id, created_at, name, description, location_label, latitude, longitude, radius_km, colour, invite_code, is_public, is_virtual, requires_approval, created_by")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const service = createServiceClient();
  const [{ count: memberCount }, { count: pinCount }] = await Promise.all([
    service.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", id),
    service.from("pins").select("*", { count: "exact", head: true }).eq("group_id", id).neq("status", "rejected"),
  ]);

  return NextResponse.json({
    ...group,
    member_count: memberCount || 0,
    pin_count: pinCount || 0,
  });
}
