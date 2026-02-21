import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
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

  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [{ data: group }, { data: members }, { data: requests }, { data: reports }] = await Promise.all([
    service
      .from("groups")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    service
      .from("group_members")
      .select("group_id, user_id, role, joined_at, profile:profiles(*)")
      .eq("group_id", id)
      .order("joined_at", { ascending: true }),
    service
      .from("join_requests")
      .select("*, profile:profiles(*)")
      .eq("group_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    service
      .from("reports")
      .select("*")
      .in(
        "pin_id",
        (
          await service
            .from("pins")
            .select("id")
            .eq("group_id", id)
        ).data?.map((pin) => pin.id) || ["00000000-0000-0000-0000-000000000000"],
      )
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { data: plugins, error: pluginsError } = await service
    .from("group_plugins")
    .select("group_id, plugin_key, is_installed, is_enabled, installed_at")
    .eq("group_id", id);

  return NextResponse.json({
    group,
    members: members || [],
    requests: requests || [],
    reports: reports || [],
    plugins: plugins || [],
    plugins_available: !pluginsError,
    plugins_error: pluginsError?.message || null,
  });
}
