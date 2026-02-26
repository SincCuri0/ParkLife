import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { emitCrdtOperation } from "@/lib/sync/crdt-emitter";
import { adaptedWrite } from "@/lib/sync/write-adapter";
import { userScopeKey } from "@/lib/sync/scope-keys";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(request, async () => {
    const { id } = await params;
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const service = createServiceClient();
    const { data: comment } = await service
      .from("comments")
      .select("id, pin_id, author_id")
      .eq("id", id)
      .maybeSingle();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const { data: pin } = await service
      .from("pins")
      .select("id, group_id")
      .eq("id", comment.pin_id)
      .maybeSingle();

    let isGroupAdmin = false;
    if (pin?.group_id) {
      const { data: membership } = await service
        .from("group_members")
        .select("role")
        .eq("group_id", pin.group_id)
        .eq("user_id", user.id)
        .maybeSingle();
      isGroupAdmin = membership?.role === "admin";
    }

    const isAuthor = comment.author_id === user.id;
    if (!isAuthor && !isGroupAdmin) {
      return NextResponse.json({ error: "You cannot delete this comment" }, { status: 403 });
    }

    const { data: child } = await service
      .from("comments")
      .select("id")
      .eq("parent_id", id)
      .limit(1)
      .maybeSingle();

    if (child) {
      const { error: updateError } = await adaptedWrite(
        async () => service
          .from("comments")
          .update({ is_deleted: true, body: "" })
          .eq("id", id),
        async () => {
          await emitCrdtOperation({
            scopeKey: pin?.group_id ? `group:${pin.group_id}` : userScopeKey(comment.author_id || user.id),
            documentType: "comments",
            entityType: "comment",
            entityId: id,
            action: "update",
            payload: { is_deleted: true },
          });
        },
      );

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { error: deleteError } = await adaptedWrite(
        async () => service
          .from("comments")
          .delete()
          .eq("id", id),
        async () => {
          await emitCrdtOperation({
            scopeKey: pin?.group_id ? `group:${pin.group_id}` : userScopeKey(comment.author_id || user.id),
            documentType: "comments",
            entityType: "comment",
            entityId: id,
            action: "delete",
            payload: null,
          });
        },
      );

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  });
}
