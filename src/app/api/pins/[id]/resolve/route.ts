import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { emitCrdtOperation } from "@/lib/sync/crdt-emitter";
import { adaptedWrite } from "@/lib/sync/write-adapter";
import { userScopeKey } from "@/lib/sync/scope-keys";

const RESOLVABLE_CATEGORIES = new Set(["help", "item"]);

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
    const { data: pin } = await service
      .from("pins")
      .select("id, posted_by, category, group_id")
      .eq("id", id)
      .maybeSingle();

    if (!pin) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    if (pin.posted_by !== user.id) {
      return NextResponse.json({ error: "Only the author can resolve this pin" }, { status: 403 });
    }

    if (!pin.category || !RESOLVABLE_CATEGORIES.has(pin.category)) {
      return NextResponse.json({ error: "Only help and item pins can be resolved" }, { status: 400 });
    }

    const { data, error } = await adaptedWrite(
      async () => service
        .from("pins")
        .update({ status: "resolved", is_resolved: true })
        .eq("id", id)
        .select("*")
        .single(),
      async () => {
        await emitCrdtOperation({
          scopeKey: pin.group_id ? `group:${pin.group_id}` : userScopeKey(user.id),
          documentType: "pins",
          entityType: "pin",
          entityId: id,
          action: "update",
          payload: { status: "resolved", is_resolved: true },
        });
      },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  });
}
