import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

const ALLOWED_STATUS = new Set(["open", "resolved", "dismissed"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(request, async () => {
    try {
      const { id } = await params;
      const authClient = await createServerClient();
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const { status } = await request.json();
      if (!ALLOWED_STATUS.has(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      const service = createServiceClient();
      const { data: report } = await service
        .from("reports")
        .select("id, pin_id, comment_id")
        .eq("id", id)
        .maybeSingle();

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      let groupId: string | null = null;
      if (report.pin_id) {
        const { data: pin } = await service
          .from("pins")
          .select("group_id")
          .eq("id", report.pin_id)
          .maybeSingle();
        groupId = pin?.group_id || null;
      }

      if (!groupId && report.comment_id) {
        const { data: comment } = await service
          .from("comments")
          .select("pin_id")
          .eq("id", report.comment_id)
          .maybeSingle();

        if (comment?.pin_id) {
          const { data: pin } = await service
            .from("pins")
            .select("group_id")
            .eq("id", comment.pin_id)
            .maybeSingle();
          groupId = pin?.group_id || null;
        }
      }

      if (groupId) {
        const { data: membership } = await service
          .from("group_members")
          .select("role")
          .eq("group_id", groupId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (membership?.role !== "admin") {
          return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }
      }

      const { error } = await service
        .from("reports")
        .update({ status })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  });
}
