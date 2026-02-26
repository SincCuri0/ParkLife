import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { buildAssistantContext } from "@/lib/assistant/context-builder";
import { getActionSummary, getAffectedEntities } from "@/lib/assistant/actions";
import { AssistantActionPreview } from "@/lib/assistant/types";
import { parseAssistantActionPreview } from "@/lib/assistant/validation";
import { withIdempotency } from "@/lib/api/idempotency";
import { getRequestUser } from "@/lib/api/request-user";
import { featureFlags } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    if (!featureFlags.assistantActionsEnabled) {
      return NextResponse.json({ error: "Assistant actions are disabled" }, { status: 404 });
    }

    const user = await getRequestUser(request);

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    let action: AssistantActionPreview | null;
    try {
      action = parseAssistantActionPreview(await request.json());
    } catch {
      action = null;
    }

    if (!action) {
      return NextResponse.json({ error: "Invalid assistant action payload" }, { status: 400 });
    }

    const confirmationToken = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const context = await buildAssistantContext(user.id);
    const service = createServiceClient();
    const { error } = await service.from("assistant_action_requests").insert({
      user_id: user.id,
      action_type: action.type,
      payload: action.payload,
      confirmation_token: confirmationToken,
      token_expires_at: expiresAt,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      confirmation_token: confirmationToken,
      summary: getActionSummary(action),
      reversible: false,
      affected_entities: getAffectedEntities(action),
      context_visibility: {
        has_location: Boolean(context.location),
        groups_available: context.groups.length,
        pin_history_entries: context.pinHistory.length,
      },
      expires_at: expiresAt,
    });
  });
}
