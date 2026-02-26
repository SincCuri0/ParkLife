import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { emitCrdtOperation } from "@/lib/sync/crdt-emitter";
import { adaptedWrite } from "@/lib/sync/write-adapter";
import { userScopeKey } from "@/lib/sync/scope-keys";

export async function PATCH(
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
    const { error } = await adaptedWrite(
      async () => service
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id),
      async () => {
        await emitCrdtOperation({
          scopeKey: userScopeKey(user.id),
          documentType: "notifications",
          entityType: "notification",
          entityId: id,
          action: "update",
          payload: { is_read: true },
        });
      },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
