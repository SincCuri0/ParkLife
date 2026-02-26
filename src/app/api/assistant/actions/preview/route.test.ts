import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServiceClientMock,
  getRequestUserMock,
  buildAssistantContextMock,
  withIdempotencyMock,
} = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  getRequestUserMock: vi.fn(),
  buildAssistantContextMock: vi.fn(),
  withIdempotencyMock: vi.fn(),
}));

vi.mock("crypto", () => ({
  randomUUID: () => "token-123",
}));

vi.mock("@/lib/env", () => ({
  featureFlags: {
    syncV2Enabled: false,
    heatmapV2Enabled: false,
    assistantActionsEnabled: true,
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

vi.mock("@/lib/api/request-user", () => ({
  getRequestUser: getRequestUserMock,
}));

vi.mock("@/lib/assistant/context-builder", () => ({
  buildAssistantContext: buildAssistantContextMock,
}));

vi.mock("@/lib/api/idempotency", () => ({
  withIdempotency: withIdempotencyMock,
}));

import { POST } from "./route";

function buildPreviewService() {
  const state: {
    insertedRequests: Array<Record<string, unknown>>;
  } = {
    insertedRequests: [],
  };

  const requestsTable = {
    insert: vi.fn(async (payload: Record<string, unknown>) => {
      state.insertedRequests.push(payload);
      return { data: null, error: null };
    }),
  };

  const service = {
    from: vi.fn((table: string) => {
      if (table === "assistant_action_requests") return requestsTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { service, state };
}

describe("assistant action preview route", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
    getRequestUserMock.mockReset();
    buildAssistantContextMock.mockReset();
    withIdempotencyMock.mockReset();
    withIdempotencyMock.mockImplementation(async (_request: Request, handler: () => Promise<Response>) => handler());
    getRequestUserMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    buildAssistantContextMock.mockResolvedValue({
      location: { latitude: 51.51, longitude: -0.13 },
      groups: [{ id: "group-1", name: "Cyclists" }],
      pinHistory: [{ id: "pin-1", title: "Morning run", created_at: "2026-02-21T10:00:00.000Z" }],
      activityPatterns: { pins_last_30_days: 3, comments_last_30_days: 1 },
      calendar: [],
    });
  });

  it("validates payload and returns 400 for invalid actions", async () => {
    const mock = buildPreviewService();
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/assistant/actions/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "unknown_action", payload: {} }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid assistant action payload" });
    expect(mock.state.insertedRequests).toHaveLength(0);
  });

  it("issues confirmation token and persists preview request for valid payloads", async () => {
    const mock = buildPreviewService();
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request("https://parklife.local/api/assistant/actions/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "create_pin",
        payload: {
          description: "Bring spare lights to the ride",
          latitude: 51.5,
          longitude: -0.12,
        },
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.confirmation_token).toBe("token-123");
    expect(body.summary).toMatch(/Create a pin at 51\.5000, -0\.1200/i);
    expect(body.affected_entities).toEqual(["pins"]);
    expect(body.context_visibility).toEqual({
      has_location: true,
      groups_available: 1,
      pin_history_entries: 1,
    });
    expect(mock.state.insertedRequests).toHaveLength(1);
    expect(mock.state.insertedRequests[0]).toMatchObject({
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      action_type: "create_pin",
      payload: {
        description: "Bring spare lights to the ride",
        latitude: 51.5,
        longitude: -0.12,
      },
      confirmation_token: "token-123",
    });
    expect(typeof mock.state.insertedRequests[0].token_expires_at).toBe("string");
  });
});
