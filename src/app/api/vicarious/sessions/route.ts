import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

const makeCode = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.group_id || "").trim();
    if (!groupId) {
      return NextResponse.json({ error: "group_id is required" }, { status: 400 });
    }

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
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: pluginRow, error: pluginError } = await service
      .from("group_plugins")
      .select("is_installed, is_enabled")
      .eq("group_id", groupId)
      .eq("plugin_key", "vicarious")
      .maybeSingle();

    if (pluginError) {
      return NextResponse.json({ error: "Plugin configuration unavailable" }, { status: 500 });
    }
    if (!pluginRow?.is_installed || !pluginRow?.is_enabled) {
      return NextResponse.json({ error: "Vicarious plugin is not active for this group" }, { status: 403 });
    }

    const { data: existing } = await service
      .from("vicarious_sessions")
      .select("*")
      .eq("group_id", groupId)
      .eq("is_active", true)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ session: existing, already_active: true }, { status: 200 });
    }

    const { data: session, error } = await service
      .from("vicarious_sessions")
      .insert({
        group_id: groupId,
        started_by: user.id,
        is_active: true,
        session_code: makeCode(),
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
