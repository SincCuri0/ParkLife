import { NextResponse } from "next/server";
import { createAnonServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = createAnonServerClient();
  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name, description, colour, location_label, invite_code, is_public, requires_approval")
    .eq("invite_code", code.toLowerCase())
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!group) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const service = createServiceClient();
  const { count } = await service
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", group.id);

  return NextResponse.json({
    ...group,
    member_count: count || 0,
  });
}
