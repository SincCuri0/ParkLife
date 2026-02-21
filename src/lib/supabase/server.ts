import { cookies } from "next/headers";
import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getValidatedSupabaseUrl() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. Expected https://<project-ref>.supabase.co",
    );
  }
  return url;
}

export function createServiceClient() {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseClient(
    getValidatedSupabaseUrl(),
    serviceKey,
  );
}

export function createAnonServerClient() {
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createSupabaseClient(
    getValidatedSupabaseUrl(),
    anonKey,
  );
}

export async function createServerClient() {
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();

  return createSsrServerClient(getValidatedSupabaseUrl(), anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // No-op for contexts that do not allow mutating cookies.
          }
        }
      },
    },
  });
}
