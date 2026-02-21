import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const service = createServiceClient();
  const [{ data: group }, { data: existing }] = await Promise.all([
    service.from("groups").select("id, requires_approval").eq("id", id).maybeSingle(),
    service
      .from("group_members")
      .select("group_id")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (existing) {
    return NextResponse.json({ success: true });
  }

  if (group.requires_approval) {
    const { error } = await service.from("join_requests").upsert(
      {
        group_id: id,
        user_id: user.id,
        status: "pending",
      },
      { onConflict: "group_id,user_id" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pending: true });
  }

  const { error } = await service.from("group_members").insert({
    group_id: id,
    user_id: user.id,
    role: "member",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
