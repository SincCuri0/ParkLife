import { NextResponse } from "next/server";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; pluginKey: string }> },
) {
  const { id, pluginKey } = await params;
  const adminCheck = await requireAdmin(id);
  if (adminCheck.error) return adminCheck.error;

  try {
    const body = await request.json();
    if (typeof body.is_enabled !== "boolean") {
      return NextResponse.json({ error: "is_enabled boolean is required" }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("group_plugins")
      .update({ is_enabled: body.is_enabled, is_installed: true })
      .eq("group_id", id)
      .eq("plugin_key", pluginKey.toLowerCase())
      .select("group_id, plugin_key, is_installed, is_enabled, installed_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: "Run group_plugins migration first." },
        { status: 500 },
      );
    }

    return NextResponse.json({ plugin: data });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; pluginKey: string }> },
) {
  const { id, pluginKey } = await params;
  const adminCheck = await requireAdmin(id);
  if (adminCheck.error) return adminCheck.error;

  const service = createServiceClient();
  const { error } = await service
    .from("group_plugins")
    .delete()
    .eq("group_id", id)
    .eq("plugin_key", pluginKey.toLowerCase());

  if (error) {
    return NextResponse.json(
      { error: error.message, hint: "Run group_plugins migration first." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
