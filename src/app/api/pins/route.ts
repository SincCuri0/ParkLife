import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { author_name, description, latitude, longitude, session_id } = body;

    if (!author_name || !description || !session_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof description !== "string" || description.trim().length > 140) {
      return NextResponse.json({ error: "Description must be 140 characters or less" }, { status: 400 });
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, is_active")
      .eq("id", session_id)
      .single();

    if (sessionError || !session || !session.is_active) {
      return NextResponse.json({ error: "Session is not active" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("pins")
      .insert({
        author_name: String(author_name).trim(),
        description: String(description).trim(),
        latitude,
        longitude,
        session_id,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
