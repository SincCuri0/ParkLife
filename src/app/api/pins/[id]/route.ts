import { NextRequest, NextResponse } from "next/server";
import { isHostRequest } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { PinStatus } from "@/lib/types";

const ALLOWED_STATUSES: PinStatus[] = ["pending", "active", "completed", "rejected"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isHostRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pins")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isHostRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pins")
    .update({ status: "rejected" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
