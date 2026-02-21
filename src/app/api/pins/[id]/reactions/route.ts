import { NextResponse } from "next/server";
import { REACTION_EMOJIS } from "@/lib/constants";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

function isValidEmoji(value: unknown): value is string {
  return typeof value === "string" && REACTION_EMOJIS.includes(value as typeof REACTION_EMOJIS[number]);
}

export async function POST(
  request: Request,
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

  try {
    const { emoji } = await request.json();
    if (!isValidEmoji(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }

    const service = createServiceClient();
    const { error } = await service.from("reactions").upsert(
      { pin_id: id, user_id: user.id, emoji },
      { onConflict: "pin_id,user_id,emoji", ignoreDuplicates: true },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
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

  try {
    const { emoji } = await request.json();
    if (!isValidEmoji(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }

    const service = createServiceClient();
    const { error } = await service
      .from("reactions")
      .delete()
      .eq("pin_id", id)
      .eq("user_id", user.id)
      .eq("emoji", emoji);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
