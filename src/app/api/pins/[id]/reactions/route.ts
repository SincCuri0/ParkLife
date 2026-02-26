import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { REACTION_EMOJIS } from "@/lib/constants";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { emitCrdtOperation } from "@/lib/sync/crdt-emitter";
import { adaptedWrite } from "@/lib/sync/write-adapter";
import { userScopeKey } from "@/lib/sync/scope-keys";

function isValidEmoji(value: unknown): value is string {
  return typeof value === "string" && REACTION_EMOJIS.includes(value as typeof REACTION_EMOJIS[number]);
}

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

    try {
      const { emoji } = await request.json();
      if (!isValidEmoji(emoji)) {
        return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
      }

      const service = createServiceClient();
      const { error } = await adaptedWrite(
        async () => service.from("reactions").upsert(
          { pin_id: id, user_id: user.id, emoji },
          { onConflict: "pin_id,user_id,emoji", ignoreDuplicates: true },
        ),
        async () => {
          await emitCrdtOperation({
            scopeKey: userScopeKey(user.id),
            documentType: "reactions",
            entityType: "reaction",
            entityId: `${id}:${user.id}:${emoji}`,
            action: "create",
            payload: { pin_id: id, user_id: user.id, emoji },
          });
        },
      );
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  });
}

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

    try {
      const { emoji } = await request.json();
      if (!isValidEmoji(emoji)) {
        return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
      }

      const service = createServiceClient();
      const { error } = await adaptedWrite(
        async () => service
          .from("reactions")
          .delete()
          .eq("pin_id", id)
          .eq("user_id", user.id)
          .eq("emoji", emoji),
        async () => {
          await emitCrdtOperation({
            scopeKey: userScopeKey(user.id),
            documentType: "reactions",
            entityType: "reaction",
            entityId: `${id}:${user.id}:${emoji}`,
            action: "delete",
            payload: { pin_id: id, user_id: user.id, emoji },
          });
        },
      );
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  });
}
