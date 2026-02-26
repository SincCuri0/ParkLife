import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
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
    heatmapRefreshToken: "refresh-secret",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

import { GET, POST } from "./route";

function buildRefreshService() {
  const state = {
    rpcCalls: [] as string[],
  };

  const service = {
    rpc: vi.fn(async (fn: string) => {
      state.rpcCalls.push(fn);
      return { data: null, error: null };
    }),
  };

  return { service, state };
}

describe("heatmap refresh route", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  it("rejects unauthorized refresh requests", async () => {
    const mock = buildRefreshService();
    createServiceClientMock.mockReturnValue(mock.service);

    const response = await POST(new Request("https://parklife.local/api/map/heatmap/refresh", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mock.state.rpcCalls).toHaveLength(0);
  });

  it("accepts authorized refresh requests via bearer token", async () => {
    const mock = buildRefreshService();
    createServiceClientMock.mockReturnValue(mock.service);

    const response = await GET(
      new Request("https://parklife.local/api/map/heatmap/refresh", {
        headers: {
          authorization: "Bearer refresh-secret",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.refreshed_at).toBe("string");
    expect(mock.state.rpcCalls).toEqual(["refresh_heatmap_cells_5m"]);
  });
});
