import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

import { IDEMPOTENCY_HEADER, withIdempotency } from "./idempotency";

type ExistingDedupRow = {
  response_body: unknown;
  status_code: number;
  expires_at: string;
} | null;

function buildDedupService(existingRow: ExistingDedupRow = null) {
  const state: { upsertPayload: Record<string, unknown> | null } = {
    upsertPayload: null,
  };

  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: existingRow, error: null })),
  };

  const tableApi = {
    select: vi.fn(() => selectChain),
    upsert: vi.fn(async (payload: Record<string, unknown>) => {
      state.upsertPayload = payload;
      return { data: null, error: null };
    }),
  };

  return {
    service: {
      from: vi.fn(() => tableApi),
    },
    state,
  };
}

describe("withIdempotency", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  it("rejects excessively long idempotency keys", async () => {
    const request = new Request("https://parklife.local/api/messages", {
      headers: {
        [IDEMPOTENCY_HEADER]: "x".repeat(201),
      },
    });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const response = await withIdempotency(request, handler);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(body).toEqual({ error: "X-Idempotency-Key is too long" });
  });

  it("passes through when header is absent", async () => {
    const request = new Request("https://parklife.local/api/messages");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }, { status: 201 }));

    const response = await withIdempotency(request, handler);
    const body = await response.json();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(response.status).toBe(201);
    expect(body).toEqual({ ok: true });
  });

  it("replays cached response when key exists", async () => {
    const nowIso = new Date(Date.now() + 60_000).toISOString();
    const mock = buildDedupService({
      response_body: { replayed: true },
      status_code: 202,
      expires_at: nowIso,
    });
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/messages", {
      headers: {
        [IDEMPOTENCY_HEADER]: "key-123",
      },
    });
    const handler = vi.fn(async () => NextResponse.json({ shouldNotRun: true }));

    const response = await withIdempotency(request, handler);
    const body = await response.json();

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(202);
    expect(response.headers.get("x-idempotency-replayed")).toBe("true");
    expect(body).toEqual({ replayed: true });
  });

  it("stores successful non-replayed responses", async () => {
    const mock = buildDedupService(null);
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/messages", {
      headers: {
        [IDEMPOTENCY_HEADER]: "key-456",
      },
    });

    const response = await withIdempotency(
      request,
      async () => NextResponse.json({ ok: true }, { status: 200 }),
    );

    expect(response.status).toBe(200);
    expect(mock.state.upsertPayload).not.toBeNull();
    expect(mock.state.upsertPayload?.idempotency_key).toBe("key-456");
    expect(mock.state.upsertPayload?.status_code).toBe(200);
  });

  it("does not persist 5xx responses", async () => {
    const mock = buildDedupService(null);
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/messages", {
      headers: {
        [IDEMPOTENCY_HEADER]: "key-789",
      },
    });

    const response = await withIdempotency(
      request,
      async () => NextResponse.json({ error: "boom" }, { status: 500 }),
    );

    expect(response.status).toBe(500);
    expect(mock.state.upsertPayload).toBeNull();
  });

  it("skips dedup persistence when response sets cookies", async () => {
    const mock = buildDedupService(null);
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/messages", {
      headers: {
        [IDEMPOTENCY_HEADER]: "cookie-response-key",
      },
    });

    const response = await withIdempotency(request, async () =>
      new NextResponse(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "session=abc123; Path=/; HttpOnly",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mock.state.upsertPayload).toBeNull();
  });
});
