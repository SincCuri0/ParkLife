import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const { id, requestId } = await params;
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { action } = await request.json();
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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

    const { data: joinRequest } = await service
      .from("join_requests")
      .select("id, group_id, user_id, status")
      .eq("id", requestId)
      .eq("group_id", id)
      .maybeSingle();

    if (!joinRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (joinRequest.status !== "pending") {
      return NextResponse.json({ error: "Request already handled" }, { status: 400 });
    }

    if (action === "approve") {
      const { error: memberError } = await service.from("group_members").insert({
        group_id: id,
        user_id: joinRequest.user_id,
        role: "member",
      });

      if (memberError && !memberError.message.includes("duplicate")) {
        return NextResponse.json({ error: memberError.message }, { status: 500 });
      }

      const { data: admins } = await service
        .from("group_members")
        .select("user_id")
        .eq("group_id", id)
        .eq("role", "admin");

      for (const admin of admins || []) {
        if (admin.user_id === joinRequest.user_id) continue;
        await createNotification({
          user_id: admin.user_id,
          type: "group_join",
          actor_id: joinRequest.user_id,
          group_id: id,
        });
      }
    }

    const { error: statusError } = await service
      .from("join_requests")
      .update({ status: action === "approve" ? "approved" : "rejected" })
      .eq("id", requestId)
      .eq("group_id", id);

    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
