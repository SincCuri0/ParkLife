import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { emitCrdtOperation } from "@/lib/sync/crdt-emitter";
import { adaptedWrite } from "@/lib/sync/write-adapter";
import { groupScopeKey, userScopeKey } from "@/lib/sync/scope-keys";

export async function POST(
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

    const { error } = await adaptedWrite(
      async () => service
        .from("group_members")
        .delete()
        .eq("group_id", id)
        .eq("user_id", user.id),
      async () => {
        await emitCrdtOperation({
          scopeKey: groupScopeKey(id),
          documentType: "group_members",
          entityType: "group_member",
          entityId: `${id}:${user.id}`,
          action: "delete",
          payload: null,
        });
        await emitCrdtOperation({
          scopeKey: userScopeKey(user.id),
          documentType: "group_members",
          entityType: "group_member",
          entityId: `${id}:${user.id}`,
          action: "delete",
          payload: null,
        });
      },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
