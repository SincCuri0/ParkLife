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
    heatmapRefreshToken: "",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

import { GET } from "./route";

type HeatmapRow = {
  geohash_5: string;
  activity_count: number;
  last_active: string;
};

function buildHeatmapService(rows: HeatmapRow[]) {
  const state: {
    gteCall: { column: string; value: number } | null;
  } = {
    gteCall: null,
  };

  const selectChain = {
    gte: vi.fn((column: string, value: number) => {
      state.gteCall = { column, value };
      return selectChain;
    }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({
      data: rows,
      error: null,
    })),
  };

  const service = {
    from: vi.fn((table: string) => {
      if (table === "heatmap_cells_5m") {
        return { select: vi.fn(() => selectChain) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { service, state };
}

describe("map heatmap route", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  it("returns normalized cells and applies bbox filtering", async () => {
    const mock = buildHeatmapService([
      {
        geohash_5: "gcpvj",
        activity_count: 9,
        last_active: "2026-02-22T00:00:00.000Z",
      },
      {
        geohash_5: "u09tv",
        activity_count: 6,
        last_active: "2026-02-22T00:00:00.000Z",
      },
    ]);
    createServiceClientMock.mockReturnValue(mock.service);

    const request = new Request(
      "https://parklife.local/api/map/heatmap?zoom=13&window=30m&bbox=-0.5,51.3,0.3,51.7",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mock.state.gteCall).toEqual({ column: "activity_count", value: 3 });
    expect(body.meta).toMatchObject({
      threshold: 3,
      zoom: 13,
      window: "30m",
      bbox: "-0.5,51.3,0.3,51.7",
    });
    expect(body.cells).toHaveLength(1);
    expect(body.cells[0]).toMatchObject({
      geohash: "gcpvj",
      intensity: 1,
      type: "ambient",
    });
  });
});
