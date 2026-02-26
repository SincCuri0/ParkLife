import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { isHostRequest } from "@/lib/auth";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { emitCrdtOperation } from "@/lib/sync/crdt-emitter";
import { adaptedWrite } from "@/lib/sync/write-adapter";
import { mapCellScopeKey, userScopeKey } from "@/lib/sync/scope-keys";
import { PinStatus } from "@/lib/types";

const ALLOWED_STATUSES: PinStatus[] = ["pending", "active", "completed", "rejected", "resolved"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(request, async () => {
    try {
      const { id } = await params;
      const { status } = await request.json();

      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      const supabase = createServiceClient();
      if (!isHostRequest(request) && request.cookies.get("vicarious_host")?.value !== "true") {
        const authClient = await createServerClient();
        const {
          data: { user },
        } = await authClient.auth.getUser();

        if (!user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: pin } = await supabase.from("pins").select("group_id").eq("id", id).maybeSingle();
        if (!pin?.group_id) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: membership } = await supabase
          .from("group_members")
          .select("role")
          .eq("group_id", pin.group_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (membership?.role !== "admin") {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }

      const { data, error } = await adaptedWrite(
        async () => supabase
          .from("pins")
          .update({ status })
          .eq("id", id)
          .select("*")
          .single(),
        async (result) => {
          if (!result.data) return;
          const scopeKey = result.data.group_id
            ? `group:${result.data.group_id}`
            : result.data.posted_by
              ? userScopeKey(result.data.posted_by)
              : mapCellScopeKey("r");
          await emitCrdtOperation({
            scopeKey,
            documentType: "pins",
            entityType: "pin",
            entityId: id,
            action: "update",
            payload: { status: result.data.status },
          });
        },
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(request, async () => {
    if (!isHostRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await adaptedWrite(
      async () => supabase
        .from("pins")
        .update({ status: "rejected" })
        .eq("id", id)
        .select("*")
        .single(),
      async (result) => {
        if (!result.data) return;
        const scopeKey = result.data.group_id
          ? `group:${result.data.group_id}`
          : result.data.posted_by
            ? userScopeKey(result.data.posted_by)
            : mapCellScopeKey("r");
        await emitCrdtOperation({
          scopeKey,
          documentType: "pins",
          entityType: "pin",
          entityId: id,
          action: "delete",
          payload: { status: "rejected" },
        });
      },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  });
}
