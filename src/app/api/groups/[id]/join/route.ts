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
    const [{ data: group }, { data: existing }] = await Promise.all([
      service.from("groups").select("id, requires_approval").eq("id", id).maybeSingle(),
      service
        .from("group_members")
        .select("group_id")
        .eq("group_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (existing) {
      return NextResponse.json({ success: true });
    }

    if (group.requires_approval) {
      const { error } = await adaptedWrite(
        async () => service.from("join_requests").upsert(
          {
            group_id: id,
            user_id: user.id,
            status: "pending",
          },
          { onConflict: "group_id,user_id" },
        ),
        async () => {
          await emitCrdtOperation({
            scopeKey: groupScopeKey(id),
            documentType: "join_requests",
            entityType: "join_request",
            entityId: `${id}:${user.id}`,
            action: "create",
            payload: { group_id: id, user_id: user.id, status: "pending" },
          });
        },
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ pending: true });
    }

    const { error } = await adaptedWrite(
      async () => service.from("group_members").insert({
        group_id: id,
        user_id: user.id,
        role: "member",
      }),
      async () => {
        await emitCrdtOperation({
          scopeKey: groupScopeKey(id),
          documentType: "group_members",
          entityType: "group_member",
          entityId: `${id}:${user.id}`,
          action: "create",
          payload: { group_id: id, user_id: user.id, role: "member" },
        });
        await emitCrdtOperation({
          scopeKey: userScopeKey(user.id),
          documentType: "group_members",
          entityType: "group_member",
          entityId: `${id}:${user.id}`,
          action: "create",
          payload: { group_id: id, user_id: user.id, role: "member" },
        });
      },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
