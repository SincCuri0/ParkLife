import { NextResponse } from "next/server";
import { executeAssistantAction } from "@/lib/assistant/actions";
import {
  AssistantActionCommit,
  isAssistantActionType,
} from "@/lib/assistant/types";
import { parseAssistantActionPayload } from "@/lib/assistant/validation";
import { withIdempotency } from "@/lib/api/idempotency";
import { getRequestUser } from "@/lib/api/request-user";
import { featureFlags } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

function parseCommit(body: unknown): AssistantActionCommit | null {
  if (!body || typeof body !== "object") return null;
  const value = body as { confirmation_token?: unknown; action_type?: unknown };
  if (typeof value.confirmation_token !== "string" || !isAssistantActionType(value.action_type)) {
    return null;
  }
  return {
    confirmation_token: value.confirmation_token.trim(),
    action_type: value.action_type,
  };
}

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    if (!featureFlags.assistantActionsEnabled) {
      return NextResponse.json({ error: "Assistant actions are disabled" }, { status: 404 });
    }

    const user = await getRequestUser(request);

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    let commit: AssistantActionCommit | null;
    try {
      commit = parseCommit(await request.json());
    } catch {
      commit = null;
    }

    if (!commit) {
      return NextResponse.json({ error: "Invalid commit payload" }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: requestRow } = await service
      .from("assistant_action_requests")
      .select("id, action_type, payload, token_expires_at")
      .eq("confirmation_token", commit.confirmation_token)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!requestRow) {
      return NextResponse.json({ error: "Invalid confirmation token" }, { status: 400 });
    }

    if (new Date(requestRow.token_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Confirmation token expired" }, { status: 400 });
    }

    if (requestRow.action_type !== commit.action_type) {
      return NextResponse.json({ error: "Action type does not match confirmation token" }, { status: 400 });
    }

    const { data: existingCommit } = await service
      .from("assistant_action_commits")
      .select("result, success")
      .eq("request_id", requestRow.id)
      .maybeSingle();
    if (existingCommit) {
      return NextResponse.json({
        success: existingCommit.success,
        ...(existingCommit.result as Record<string, unknown>),
      });
    }

    if (!isAssistantActionType(requestRow.action_type)) {
      return NextResponse.json({ error: "Unsupported action type" }, { status: 400 });
    }

    const action = parseAssistantActionPayload(requestRow.action_type, requestRow.payload);
    if (!action) {
      return NextResponse.json({ error: "Stored action payload is invalid" }, { status: 400 });
    }

    try {
      const result = await executeAssistantAction(user.id, action);
      await service.from("assistant_action_commits").insert({
        request_id: requestRow.id,
        success: true,
        result,
      });

      return NextResponse.json({
        success: true,
        entity_id: result.entityId,
        redirect_url: result.redirectUrl,
      });
    } catch (error) {
      await service.from("assistant_action_commits").insert({
        request_id: requestRow.id,
        success: false,
        result: {
          error: error instanceof Error ? error.message : "Commit failed",
        },
      });
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Commit failed" },
        { status: 400 },
      );
    }
  });
}
