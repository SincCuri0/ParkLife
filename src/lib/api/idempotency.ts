import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const IDEMPOTENCY_HEADER = "x-idempotency-key";

type ResponseBody = unknown;

async function extractResponseBody(response: NextResponse<ResponseBody>) {
  try {
    return await response.clone().json();
  } catch {
    try {
      const text = await response.clone().text();
      return { message: text };
    } catch {
      return {};
    }
  }
}

export async function withIdempotency(
  request: Request,
  handler: () => Promise<NextResponse<ResponseBody>>,
) {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (!key) {
    return handler();
  }

  if (key.length > 200) {
    return NextResponse.json({ error: "X-Idempotency-Key is too long" }, { status: 400 });
  }

  const service = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data: existing, error: existingError } = await service
    .from("request_dedup")
    .select("response_body, status_code, expires_at")
    .eq("idempotency_key", key)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (!existingError && existing) {
    return NextResponse.json(existing.response_body, {
      status: existing.status_code || 200,
      headers: {
        "x-idempotency-replayed": "true",
      },
    });
  }

  const response = await handler();
  if (response.headers.has("set-cookie")) {
    return response;
  }
  const body = await extractResponseBody(response);

  if (response.status < 500) {
    await service.from("request_dedup").upsert({
      idempotency_key: key,
      response_body: body,
      status_code: response.status,
      created_at: nowIso,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return response;
}
