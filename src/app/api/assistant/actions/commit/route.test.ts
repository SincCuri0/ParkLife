import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServiceClientMock,
  getRequestUserMock,
  executeAssistantActionMock,
  withIdempotencyMock,
} = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  getRequestUserMock: vi.fn(),
  executeAssistantActionMock: vi.fn(),
  withIdempotencyMock: vi.fn(),
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

vi.mock("@/lib/assistant/actions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assistant/actions")>("@/lib/assistant/actions");
  return {
    ...actual,
    executeAssistantAction: executeAssistantActionMock,
  };
});

vi.mock("@/lib/api/idempotency", () => ({
  withIdempotency: withIdempotencyMock,
}));

import { POST } from "./route";

type CommitRequestRow = {
  id: string;
  action_type: string;
  payload: unknown;
  token_expires_at: string;
} | null;

type ExistingCommitRow = {
  success: boolean;
  result: Record<string, unknown>;
} | null;

function buildCommitService(options: { requestRow: CommitRequestRow; existingCommit: ExistingCommitRow }) {
  const state: {
    commitInserts: Array<Record<string, unknown>>;
  } = {
    commitInserts: [],
  };

  const requestSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options.requestRow,
      error: null,
    })),
  };

  const commitsSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options.existingCommit,
      error: null,
    })),
  };

  const commitsTable = {
    select: vi.fn(() => commitsSelect),
    insert: vi.fn(async (payload: Record<string, unknown>) => {
      state.commitInserts.push(payload);
      return { data: null, error: null };
    }),
  };

  const service = {
    from: vi.fn((table: string) => {
      if (table === "assistant_action_requests") return { select: vi.fn(() => requestSelect) };
      if (table === "assistant_action_commits") return commitsTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { service, state };
}

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

function buildCommitRequest(token = "token-1") {
  return new Request("https://parklife.local/api/assistant/actions/commit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirmation_token: token,
      action_type: "send_message",
    }),
  });
}

describe("assistant action commit route", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
    getRequestUserMock.mockReset();
    executeAssistantActionMock.mockReset();
    withIdempotencyMock.mockReset();
    getRequestUserMock.mockResolvedValue({ id: USER_ID });
    withIdempotencyMock.mockImplementation(async (_request: Request, handler: () => Promise<Response>) => handler());
  });

  it("replays an existing commit result without executing action again", async () => {
    const mock = buildCommitService({
      requestRow: {
        id: "request-1",
        action_type: "send_message",
        payload: {
          conversation_id: "neighbours",
          content: "See you at 7.",
        },
        token_expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      existingCommit: {
        success: true,
        result: {
          entity_id: "message-1",
          redirect_url: "/map",
        },
      },
    });
    createServiceClientMock.mockReturnValue(mock.service);

    const response = await POST(buildCommitRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      entity_id: "message-1",
      redirect_url: "/map",
    });
    expect(executeAssistantActionMock).not.toHaveBeenCalled();
    expect(mock.state.commitInserts).toHaveLength(0);
  });

  it("executes action and persists commit result when no prior commit exists", async () => {
    const mock = buildCommitService({
      requestRow: {
        id: "request-2",
        action_type: "send_message",
        payload: {
          conversation_id: "ride-planning",
          content: "Draft route is live.",
        },
        token_expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      existingCommit: null,
    });
    createServiceClientMock.mockReturnValue(mock.service);
    executeAssistantActionMock.mockResolvedValue({
      entityId: "message-2",
      redirectUrl: "/map",
    });

    const response = await POST(buildCommitRequest("token-2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      entity_id: "message-2",
      redirect_url: "/map",
    });
    expect(executeAssistantActionMock).toHaveBeenCalledTimes(1);
    expect(executeAssistantActionMock).toHaveBeenCalledWith(USER_ID, {
      type: "send_message",
      payload: {
        conversation_id: "ride-planning",
        content: "Draft route is live.",
      },
    });
    expect(mock.state.commitInserts).toHaveLength(1);
    expect(mock.state.commitInserts[0]).toEqual({
      request_id: "request-2",
      success: true,
      result: {
        entityId: "message-2",
        redirectUrl: "/map",
      },
    });
  });

  it("rejects expired confirmation tokens", async () => {
    const mock = buildCommitService({
      requestRow: {
        id: "request-expired",
        action_type: "send_message",
        payload: {
          conversation_id: "ride-planning",
          content: "This should not send.",
        },
        token_expires_at: new Date(Date.now() - 1_000).toISOString(),
      },
      existingCommit: null,
    });
    createServiceClientMock.mockReturnValue(mock.service);

    const response = await POST(buildCommitRequest("expired-token"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Confirmation token expired" });
    expect(executeAssistantActionMock).not.toHaveBeenCalled();
    expect(mock.state.commitInserts).toHaveLength(0);
  });
});
