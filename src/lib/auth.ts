import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function isHostAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get("host_authenticated")?.value === "true";
}

export function isHostRequest(request: NextRequest) {
  return request.cookies.get("host_authenticated")?.value === "true";
}
