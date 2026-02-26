import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock, withIdempotencyMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  withIdempotencyMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  featureFlags: {
    syncV2Enabled: false,
    heatmapV2Enabled: true,
    assistantActionsEnabled: false,
    localFirstEnabled: false,
    nodeHostingEnabled: false,
    parkPoundEnabled: false,
  },
  runtimeConfig: {
    protocolVersion: "2026-02-v1",
    heatmapKAnonymityThreshold: 3,
    heatmapRefreshToken: "",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/lib/api/idempotency", () => ({
  withIdempotency: withIdempotencyMock,
}));

import { POST } from "./route";

function buildPresenceService() {
  const state: {
    insertedEvents: Array<Record<string, unknown>>;
  } = {
    insertedEvents: [],
  };

  const eventsTable = {
    insert: vi.fn(async (payload: Record<string, unknown>) => {
      state.insertedEvents.push(payload);
      return { data: null, error: null };
    }),
  };

  const service = {
    from: vi.fn((table: string) => {
      if (table === "presence_events") return eventsTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { service, state };
}

describe("map presence route", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
    withIdempotencyMock.mockReset();
    withIdempotencyMock.mockImplementation(async (_request: Request, handler: () => Promise<Response>) => handler());
  });

  it("rejects malformed geohash_5 values", async () => {
    const mock = buildPresenceService();
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/map/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        geohash_5: "abc",
        event_type: "active",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "geohash_5 must be a valid 5-char geohash" });
    expect(mock.state.insertedEvents).toHaveLength(0);
  });

  it("rejects unsupported event_type values", async () => {
    const mock = buildPresenceService();
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/map/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        geohash_5: "gcpvj",
        event_type: "idle",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "event_type must be active or node_hosting" });
    expect(mock.state.insertedEvents).toHaveLength(0);
  });

  it("inserts validated presence events", async () => {
    const mock = buildPresenceService();
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/map/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        geohash_5: "GCPVJ",
        event_type: "active",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true });
    expect(mock.state.insertedEvents).toEqual([
      {
        geohash_5: "gcpvj",
        event_type: "active",
      },
    ]);
  });
});
