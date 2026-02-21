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
  const { data: membership } = await service
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a group member" }, { status: 400 });
  }

  if (membership.role === "admin") {
    const { count } = await service
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", id)
      .eq("role", "admin");
    if ((count || 0) <= 1) {
      return NextResponse.json({ error: "Assign another admin before leaving" }, { status: 400 });
    }
  }

  const { error } = await service
    .from("group_members")
    .delete()
    .eq("group_id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
