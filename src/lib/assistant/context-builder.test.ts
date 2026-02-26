import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

import { buildAssistantContext } from "./context-builder";

type ContextServiceOptions = {
  sharing?: Record<string, boolean>;
  location?: { latitude: number; longitude: number } | null;
  groups?: Array<{ group: { id: string; name: string } | Array<{ id: string; name: string }> }>;
  pins?: Array<{ id: string; title: string | null; created_at: string }>;
  pinCount?: number;
  commentCount?: number;
};

function buildContextService(options: ContextServiceOptions = {}) {
  const state = {
    tableCalls: [] as string[],
  };

  const profilesSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: {
        ai_data_sharing: options.sharing || {},
      },
      error: null,
    })),
  };

  const lampSelect = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options.location
        ? {
            latitude: options.location.latitude,
            longitude: options.location.longitude,
            updated_at: "2026-02-22T00:00:00.000Z",
          }
        : null,
      error: null,
    })),
  };

  const groupMembersSelect = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({
      data: options.groups || [],
      error: null,
    })),
  };

  const pinsTable = {
    select: vi.fn((_: string, queryOptions?: { head?: boolean }) => {
      if (queryOptions?.head) {
        return {
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn(async () => ({
            count: options.pinCount ?? 0,
            data: null,
            error: null,
          })),
        };
      }

      return {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn(async () => ({
          data: options.pins || [],
          error: null,
        })),
      };
    }),
  };

  const commentsSelect = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn(async () => ({
      count: options.commentCount ?? 0,
      data: null,
      error: null,
    })),
  };

  const service = {
    from: vi.fn((table: string) => {
      state.tableCalls.push(table);
      if (table === "profiles") {
        return { select: vi.fn(() => profilesSelect) };
      }
      if (table === "lamp_presence") {
        return { select: vi.fn(() => lampSelect) };
      }
      if (table === "group_members") {
        return { select: vi.fn(() => groupMembersSelect) };
      }
      if (table === "pins") {
        return pinsTable;
      }
      if (table === "comments") {
        return { select: vi.fn(() => commentsSelect) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { service, state };
}

describe("buildAssistantContext", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  it("returns minimal context when all sharing toggles are off", async () => {
    const mock = buildContextService({
      sharing: {
        location: false,
        group_memberships: false,
        pin_history: false,
        activity_patterns: false,
        calendar: false,
      },
    });
    createServiceClientMock.mockReturnValue(mock.service);

    const context = await buildAssistantContext("user-1");

    expect(context.location).toBeNull();
    expect(context.groups).toEqual([]);
    expect(context.pinHistory).toEqual([]);
    expect(context.activityPatterns).toBeNull();
    expect(context.calendar).toEqual([]);
    expect(mock.state.tableCalls).toEqual(["profiles"]);
  });

  it("includes only opted-in fields and computes activity counts", async () => {
    const mock = buildContextService({
      sharing: {
        location: true,
        group_memberships: true,
        pin_history: true,
        activity_patterns: true,
        calendar: false,
      },
      location: { latitude: 51.51, longitude: -0.13 },
      groups: [
        {
          group: { id: "group-1", name: "Cyclists" },
        },
      ],
      pins: [
        {
          id: "pin-1",
          title: "Morning run",
          created_at: "2026-02-21T10:00:00.000Z",
        },
      ],
      pinCount: 5,
      commentCount: 9,
    });
    createServiceClientMock.mockReturnValue(mock.service);

    const context = await buildAssistantContext("user-2");

    expect(context.location).toEqual({ latitude: 51.51, longitude: -0.13 });
    expect(context.groups).toEqual([{ id: "group-1", name: "Cyclists" }]);
    expect(context.pinHistory).toHaveLength(1);
    expect(context.activityPatterns).toEqual({
      pins_last_30_days: 5,
      comments_last_30_days: 9,
    });
    expect(context.calendar).toEqual([]);
    expect(mock.state.tableCalls).toEqual([
      "profiles",
      "lamp_presence",
      "group_members",
      "pins",
      "pins",
      "comments",
    ]);
  });
});
