import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock, createServerClientMock, withIdempotencyMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  createServerClientMock: vi.fn(),
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
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/api/idempotency", () => ({
  withIdempotency: withIdempotencyMock,
}));

import { DELETE, GET, POST } from "./route";

type LampRow = {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  profile: {
    lamp_visibility_enabled?: boolean;
    ai_data_sharing?: { location?: boolean };
  } | null;
};

function buildLampsService(options: { lampRows?: LampRow[]; profile?: Record<string, unknown> | null }) {
  const state: {
    deletedUserIds: string[];
    upserts: Array<Record<string, unknown>>;
  } = {
    deletedUserIds: [],
    upserts: [],
  };

  const lampsSelect = {
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({
      data: options.lampRows || [],
      error: null,
    })),
  };

  const lampsTable = {
    select: vi.fn(() => lampsSelect),
    delete: vi.fn(() => ({
      eq: vi.fn(async (_column: string, value: string) => {
        state.deletedUserIds.push(value);
        return { data: null, error: null };
      }),
    })),
    upsert: vi.fn(async (payload: Record<string, unknown>) => {
      state.upserts.push(payload);
      return { data: null, error: null };
    }),
  };

  const profileSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options.profile ?? null,
      error: null,
    })),
  };

  const service = {
    from: vi.fn((table: string) => {
      if (table === "lamp_presence") return lampsTable;
      if (table === "profiles") return { select: vi.fn(() => profileSelect) };
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { service, state };
}

function buildAuthClient(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: userId ? { id: userId } : null,
        },
      })),
    },
  };
}

describe("map lamps route", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
    createServerClientMock.mockReset();
    withIdempotencyMock.mockReset();
    withIdempotencyMock.mockImplementation(async (_request: Request, handler: () => Promise<Response>) => handler());
  });

  it("GET only returns recent lamp rows with both consent toggles enabled", async () => {
    const now = Date.now();
    const mock = buildLampsService({
      lampRows: [
        {
          user_id: "u-visible",
          latitude: 51.5,
          longitude: -0.12,
          updated_at: new Date(now - 15_000).toISOString(),
          profile: {
            lamp_visibility_enabled: true,
            ai_data_sharing: { location: true },
          },
        },
        {
          user_id: "u-no-consent",
          latitude: 51.51,
          longitude: -0.11,
          updated_at: new Date(now - 10_000).toISOString(),
          profile: {
            lamp_visibility_enabled: false,
            ai_data_sharing: { location: true },
          },
        },
        {
          user_id: "u-stale",
          latitude: 51.49,
          longitude: -0.13,
          updated_at: new Date(now - 120_000).toISOString(),
          profile: {
            lamp_visibility_enabled: true,
            ai_data_sharing: { location: true },
          },
        },
      ],
      profile: null,
    });
    createServiceClientMock.mockReturnValue(mock.service);

    const response = await GET(new Request("https://parklife.local/api/map/lamps"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lamps).toHaveLength(1);
    expect(body.lamps[0]).toMatchObject({
      user_id: "u-visible",
      latitude: 51.5,
      longitude: -0.12,
    });
  });

  it("POST revokes lamp presence when profile consent is missing", async () => {
    const mock = buildLampsService({
      profile: {
        lamp_visibility_enabled: false,
        ai_data_sharing: { location: true },
      },
    });
    createServiceClientMock.mockReturnValue(mock.service);
    createServerClientMock.mockResolvedValue(buildAuthClient("user-1"));

    const response = await POST(
      new Request("https://parklife.local/api/map/lamps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: 51.5, longitude: -0.12 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/Enable lamp visibility and location sharing/i);
    expect(mock.state.deletedUserIds).toEqual(["user-1"]);
    expect(mock.state.upserts).toHaveLength(0);
  });

  it("POST upserts lamp presence when consent and coordinates are valid", async () => {
    const mock = buildLampsService({
      profile: {
        lamp_visibility_enabled: true,
        ai_data_sharing: { location: true },
      },
    });
    createServiceClientMock.mockReturnValue(mock.service);
    createServerClientMock.mockResolvedValue(buildAuthClient("user-2"));

    const response = await POST(
      new Request("https://parklife.local/api/map/lamps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: 51.5, longitude: -0.12 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.updated_at).toBe("string");
    expect(mock.state.deletedUserIds).toHaveLength(0);
    expect(mock.state.upserts).toHaveLength(1);
    expect(mock.state.upserts[0]).toMatchObject({
      user_id: "user-2",
      latitude: 51.5,
      longitude: -0.12,
    });
  });

  it("DELETE removes lamp presence for authenticated users", async () => {
    const mock = buildLampsService({ profile: null });
    createServiceClientMock.mockReturnValue(mock.service);
    createServerClientMock.mockResolvedValue(buildAuthClient("user-3"));

    const response = await DELETE(
      new Request("https://parklife.local/api/map/lamps", {
        method: "DELETE",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mock.state.deletedUserIds).toEqual(["user-3"]);
  });
});
