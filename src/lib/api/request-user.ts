import type { User } from "@supabase/supabase-js";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

function parseBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export async function getRequestUser(request: Request): Promise<User | null> {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (user) {
    return user;
  }

  const token = parseBearerToken(request);
  if (!token) {
    return null;
  }

  const service = createServiceClient();
  const {
    data: { user: tokenUser },
  } = await service.auth.getUser(token);

  return tokenUser || null;
}
