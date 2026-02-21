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
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24,
    };

    response.cookies.set({ name: "host_authenticated", value: "true", ...cookieOptions });
    response.cookies.set({ name: "vicarious_host", value: "true", ...cookieOptions });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
