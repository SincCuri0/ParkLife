import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock, getRequestUserMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  getRequestUserMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  featureFlags: {
    syncV2Enabled: true,
    heatmapV2Enabled: false,
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

vi.mock("@/lib/api/request-user", () => ({
  getRequestUser: getRequestUserMock,
}));

import { GET } from "./route";

type SyncOpRow = {
  sequence_no: number;
  op_data: string;
  client_id: string;
  created_at: string;
};

type PullServiceOptions = {
  existingDeviceId?: string | null;
  checkpoint?: number;
  documents?: Array<{ id: string }>;
  operations?: SyncOpRow[];
};

function buildPullService(options: PullServiceOptions = {}) {
  const state: {
    checkpointUpserts: Array<Record<string, unknown>>;
    deviceUpdates: Array<Record<string, unknown>>;
    deviceUpserts: Array<Record<string, unknown>>;
    opsGt: number | null;
  } = {
    checkpointUpserts: [],
    deviceUpdates: [],
    deviceUpserts: [],
    opsGt: null,
  };

  const groupMembersSelect = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({ data: [], error: null })),
  };

  const devicesSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options.existingDeviceId ? { id: options.existingDeviceId } : null,
      error: null,
    })),
  };

  const devicesTable = {
    select: vi.fn(() => devicesSelect),
    upsert: vi.fn((payload: Record<string, unknown>) => {
      state.deviceUpserts.push(payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { id: "device-new" },
            error: null,
          })),
        })),
      };
    }),
    update: vi.fn((payload: Record<string, unknown>) => ({
      eq: vi.fn(async () => {
        state.deviceUpdates.push(payload);
        return { data: null, error: null };
      }),
    })),
  };

  const checkpointSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: { checkpoint_lsn: options.checkpoint ?? 0 },
      error: null,
    })),
  };

  const checkpointsTable = {
    select: vi.fn(() => checkpointSelect),
    upsert: vi.fn(async (payload: Record<string, unknown>) => {
      state.checkpointUpserts.push(payload);
      return { data: null, error: null };
    }),
  };

  const documentsSelect = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({
      data: options.documents ?? [],
      error: null,
    })),
  };

  const documentsTable = {
    select: vi.fn(() => documentsSelect),
  };

  const opsSelect = {
    in: vi.fn().mockReturnThis(),
    gt: vi.fn((_: string, value: number) => {
      state.opsGt = value;
      return opsSelect;
    }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({
      data: options.operations ?? [],
      error: null,
    })),
  };

  const opsTable = {
    select: vi.fn(() => opsSelect),
  };

  const service = {
    from: vi.fn((table: string) => {
      if (table === "group_members") return { select: vi.fn(() => groupMembersSelect) };
      if (table === "devices") return devicesTable;
      if (table === "sync_checkpoints") return checkpointsTable;
      if (table === "crdt_documents") return documentsTable;
      if (table === "crdt_ops_log") return opsTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { service, state };
}

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

function buildPullRequest(scope: string) {
  return new Request(`https://parklife.local/api/sync/pull?scope=${encodeURIComponent(scope)}`, {
    headers: {
      "x-parklife-protocol": "2026-02-v1",
      "x-device-fingerprint": "device-fingerprint-1",
      "x-device-id": "device-1",
    },
  });
}

describe("sync pull route GET", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
    getRequestUserMock.mockReset();
    getRequestUserMock.mockResolvedValue({ id: USER_ID });
  });

  it("keeps checkpoint unchanged and does not upsert when no newer operations exist", async () => {
    const mock = buildPullService({
      existingDeviceId: "device-1",
      checkpoint: 12,
      documents: [{ id: "doc-1" }],
      operations: [],
    });
    createServiceClientMock.mockReturnValue(mock.service);

    const response = await GET(buildPullRequest(`user:${USER_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scopes).toHaveLength(1);
    expect(body.scopes[0].checkpoint_lsn).toBe(12);
    expect(body.scopes[0].next_checkpoint_lsn).toBe(12);
    expect(body.scopes[0].operations).toEqual([]);
    expect(mock.state.opsGt).toBe(12);
    expect(mock.state.checkpointUpserts).toHaveLength(0);
  });

  it("advances checkpoint when newer operations are returned", async () => {
    const mock = buildPullService({
      existingDeviceId: "device-1",
      checkpoint: 4,
      documents: [{ id: "doc-2" }],
      operations: [
        {
          sequence_no: 7,
          op_data: "\\x7b22656e747279223a317d",
          client_id: "device-a",
          created_at: "2026-02-22T00:00:00.000Z",
        },
        {
          sequence_no: 9,
          op_data: "\\x7b22656e747279223a327d",
          client_id: "device-b",
          created_at: "2026-02-22T00:00:01.000Z",
        },
      ],
    });
    createServiceClientMock.mockReturnValue(mock.service);

    const response = await GET(buildPullRequest(`user:${USER_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scopes[0].checkpoint_lsn).toBe(4);
    expect(body.scopes[0].next_checkpoint_lsn).toBe(9);
    expect(body.scopes[0].operations).toHaveLength(2);
    expect(mock.state.checkpointUpserts).toHaveLength(1);
    expect(mock.state.checkpointUpserts[0]).toMatchObject({
      device_id: "device-1",
      scope_key: `user:${USER_ID}`,
      checkpoint_lsn: 9,
    });
  });
});
