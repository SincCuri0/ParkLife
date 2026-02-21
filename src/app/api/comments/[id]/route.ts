import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: comment } = await service
    .from("comments")
    .select("id, pin_id, author_id")
    .eq("id", id)
    .maybeSingle();

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const { data: pin } = await service
    .from("pins")
    .select("id, group_id")
    .eq("id", comment.pin_id)
    .maybeSingle();

  let isGroupAdmin = false;
  if (pin?.group_id) {
    const { data: membership } = await service
      .from("group_members")
      .select("role")
      .eq("group_id", pin.group_id)
      .eq("user_id", user.id)
      .maybeSingle();
    isGroupAdmin = membership?.role === "admin";
  }

  const isAuthor = comment.author_id === user.id;
  if (!isAuthor && !isGroupAdmin) {
    return NextResponse.json({ error: "You cannot delete this comment" }, { status: 403 });
  }

  const { data: child } = await service
    .from("comments")
    .select("id")
    .eq("parent_id", id)
    .limit(1)
    .maybeSingle();

  if (child) {
    const { error: updateError } = await service
      .from("comments")
      .update({ is_deleted: true, body: "" })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    const { error: deleteError } = await service
      .from("comments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
