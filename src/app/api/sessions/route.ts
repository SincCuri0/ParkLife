import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") === "true";
  const limitValue = Number(url.searchParams.get("limit") || "20");
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(limitValue, 100)) : 20;

  const supabase = createServiceClient();
  let query = supabase
    .from("sessions")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  try {
    const { name, password } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Session name is required" }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const id = nanoid(8).toLowerCase();
    const hostPasswordHash = await bcrypt.hash(password, 10);

    const supabase = createServiceClient();
    const { error } = await supabase.from("sessions").insert({
      id,
      name: name.trim(),
      host_password_hash: hostPasswordHash,
      is_active: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id, name: name.trim() }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
