import { NextResponse } from "next/server";
import { COMMENT_MAX_LENGTH } from "@/lib/constants";
import { createNotification } from "@/lib/notifications";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const pinId = String(body?.pin_id || "").trim();
    const parentId = body?.parent_id ? String(body.parent_id).trim() : null;
    const textBody = String(body?.body || "").trim();

    if (!pinId || !textBody) {
      return NextResponse.json({ error: "pin_id and body are required" }, { status: 400 });
    }

    if (textBody.length > COMMENT_MAX_LENGTH) {
      return NextResponse.json({ error: `Comments must be ${COMMENT_MAX_LENGTH} characters or less` }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: pin, error: pinError } = await service
      .from("pins")
      .select("id, status, group_id, posted_by, expires_at")
      .eq("id", pinId)
      .maybeSingle();

    if (pinError || !pin) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    if (pin.status === "rejected" || pin.status === "resolved") {
      return NextResponse.json({ error: "Comments are closed for this pin" }, { status: 400 });
    }

    if (pin.expires_at && new Date(pin.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Comments are closed for expired pins" }, { status: 400 });
    }

    let parentComment:
      | { id: string; pin_id: string; parent_id: string | null; author_id: string | null }
      | null = null;

    if (parentId) {
      const { data: parent, error: parentError } = await service
        .from("comments")
        .select("id, pin_id, parent_id, author_id, is_deleted")
        .eq("id", parentId)
        .maybeSingle();

      if (parentError || !parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
      if (parent.pin_id !== pinId) {
        return NextResponse.json({ error: "Parent comment must belong to the same pin" }, { status: 400 });
      }
      if (parent.parent_id) {
        return NextResponse.json({ error: "Replies can only be one level deep" }, { status: 400 });
      }
      if (parent.is_deleted) {
        return NextResponse.json({ error: "Cannot reply to removed comments" }, { status: 400 });
      }

      parentComment = parent;
    }

    const { data: created, error: createError } = await service
      .from("comments")
      .insert({
        pin_id: pinId,
        author_id: user.id,
        parent_id: parentId,
        body: textBody,
      })
      .select("*, author:profiles(*)")
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: createError?.message || "Could not create comment" }, { status: 500 });
    }

    if (pin.posted_by && pin.posted_by !== user.id) {
      await createNotification({
        user_id: pin.posted_by,
        type: "comment_on_pin",
        actor_id: user.id,
        pin_id: pin.id,
        comment_id: created.id,
      });
    }

    if (parentComment?.author_id && parentComment.author_id !== user.id) {
      await createNotification({
        user_id: parentComment.author_id,
        type: "reply_to_comment",
        actor_id: user.id,
        pin_id: pin.id,
        comment_id: created.id,
      });
    }

    const exclude = new Set<string>([user.id]);
    if (pin.posted_by) exclude.add(pin.posted_by);
    if (parentComment?.author_id) exclude.add(parentComment.author_id);

    const { data: commenters } = await service
      .from("comments")
      .select("author_id")
      .eq("pin_id", pin.id)
      .not("author_id", "is", null);

    const coCommenters = new Set(
      (commenters || [])
        .map((row) => row.author_id as string)
        .filter((id) => id && !exclude.has(id)),
    );

    for (const commenterId of coCommenters) {
      await createNotification({
        user_id: commenterId,
        type: "co_comment",
        actor_id: user.id,
        pin_id: pin.id,
        comment_id: created.id,
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
