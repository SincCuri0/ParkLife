import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_SETUP_PATH = "/profile/setup";
const SITE_URL_ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "SITE_URL", "APP_URL"] as const;

function toOrigin(value: string | undefined): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;

  const withProtocol =
    trimmed.startsWith("https://") || trimmed.startsWith("http://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function getMagicLinkOrigin(request: Request): string {
  if (process.env.NODE_ENV === "production") {
    for (const key of SITE_URL_ENV_KEYS) {
      const configuredOrigin = toOrigin(process.env[key]);
      if (configuredOrigin) return configuredOrigin;
    }

    const vercelOrigin =
      toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ?? toOrigin(process.env.VERCEL_URL);
    if (vercelOrigin) return vercelOrigin;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const origin = getMagicLinkOrigin(request);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${origin}${PROFILE_SETUP_PATH}`,
      },
    });

    if (error) {
      return NextResponse.json({ error: "Could not send magic link" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
