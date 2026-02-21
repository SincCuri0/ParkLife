import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. Expected https://<project-ref>.supabase.co",
    );
  }
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createBrowserClient(
    url,
    anonKey,
  );
}
