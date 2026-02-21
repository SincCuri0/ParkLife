import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (!process.env.HOST_SECRET) {
      return NextResponse.json({ error: "HOST_SECRET is not configured" }, { status: 500 });
    }

    if (password !== process.env.HOST_SECRET) {
      return NextResponse.json({ error: "Invalid host password" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: "host_authenticated",
      value: "true",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
