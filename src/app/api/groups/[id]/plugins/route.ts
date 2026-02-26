import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

async function requireAdmin(groupId: string) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }), user: null };
  }

  const service = createServiceClient();
  const { data: membership } = await service
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }), user: null };
  }

  return { error: null, user };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const adminCheck = await requireAdmin(id);
  if (adminCheck.error) return adminCheck.error;

  const service = createServiceClient();
  const { data, error } = await service
    .from("group_plugins")
    .select("group_id, plugin_key, is_installed, is_enabled, installed_at")
    .eq("group_id", id)
    .order("plugin_key", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message, hint: "Run group_plugins migration first." },
      { status: 500 },
    );
  }

  return NextResponse.json({ plugins: data || [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(request, async () => {
    const { id } = await params;
    const adminCheck = await requireAdmin(id);
    if (adminCheck.error || !adminCheck.user) return adminCheck.error;

    try {
      const body = await request.json();
      const pluginKey = String(body.plugin_key || "").trim().toLowerCase();
      if (!pluginKey) {
        return NextResponse.json({ error: "plugin_key is required" }, { status: 400 });
      }

      const service = createServiceClient();
      const { data, error } = await service
        .from("group_plugins")
        .upsert(
          {
            group_id: id,
            plugin_key: pluginKey,
            is_installed: true,
            is_enabled: false,
            installed_by: adminCheck.user.id,
          },
          { onConflict: "group_id,plugin_key" },
        )
        .select("group_id, plugin_key, is_installed, is_enabled, installed_at")
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message, hint: "Run group_plugins migration first." },
          { status: 500 },
        );
      }

      return NextResponse.json({ plugin: data }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  });
}
