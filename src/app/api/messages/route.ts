import { NextResponse } from "next/server";
import { withIdempotency } from "@/lib/api/idempotency";
import { getRequestUser } from "@/lib/api/request-user";
import { createServiceClient } from "@/lib/supabase/server";

const MAX_ID_LENGTH = 120;
const MAX_CONVERSATION_ID_LENGTH = 120;
const MAX_CONTENT_LENGTH = 2000;

type MessageInsertBody = {
  id: string;
  conversation_id: string;
  sender_id?: string;
  content: string;
  created_at?: number | string;
};

function normalizeCreatedAt(value: MessageInsertBody["created_at"]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return new Date().toISOString();
}

function parseBody(body: unknown): MessageInsertBody | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Partial<MessageInsertBody>;

  if (typeof value.id !== "string" || !value.id.trim()) return null;
  if (typeof value.conversation_id !== "string" || !value.conversation_id.trim()) return null;
  if (typeof value.content !== "string") return null;
  if (typeof value.sender_id !== "undefined" && typeof value.sender_id !== "string") return null;

  return {
    id: value.id.trim(),
    conversation_id: value.conversation_id.trim(),
    sender_id: value.sender_id?.trim(),
    content: value.content.trim(),
    created_at: value.created_at,
  };
}

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    let body: MessageInsertBody | null;
    try {
      body = parseBody(await request.json());
    } catch {
      body = null;
    }

    if (!body) {
      return NextResponse.json({ error: "Invalid message payload" }, { status: 400 });
    }

    if (body.id.length > MAX_ID_LENGTH) {
      return NextResponse.json({ error: "Message id is too long" }, { status: 400 });
    }

    if (body.conversation_id.length > MAX_CONVERSATION_ID_LENGTH) {
      return NextResponse.json({ error: "conversation_id is too long" }, { status: 400 });
    }

    if (!body.content || body.content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `content must be between 1 and ${MAX_CONTENT_LENGTH} characters` },
        { status: 400 },
      );
    }

    if (body.sender_id && body.sender_id !== user.id) {
      return NextResponse.json({ error: "sender_id does not match authenticated user" }, { status: 403 });
    }

    const service = createServiceClient();
    const { data: existing, error: existingError } = await service
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .eq("id", body.id)
      .maybeSingle();

    if (existingError) {
      if (existingError.code === "42P01") {
        return NextResponse.json(
          { error: "Messages table is not available", hint: "Run migrations/20260222_messages.sql" },
          { status: 501 },
        );
      }
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ ...existing, duplicate: true }, { status: 409 });
    }

    const { data, error } = await service
      .from("messages")
      .insert({
        id: body.id,
        conversation_id: body.conversation_id,
        sender_id: user.id,
        content: body.content,
        created_at: normalizeCreatedAt(body.created_at),
      })
      .select("id, conversation_id, sender_id, content, created_at")
      .single();

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Messages table is not available", hint: "Run migrations/20260222_messages.sql" },
          { status: 501 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  });
}
