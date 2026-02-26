import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

import { emitCrdtOperation } from "./crdt-emitter";

type EmitterMockOptions = {
  existingDocumentId?: string | null;
  createdDocumentId?: string | null;
  rpcData?: unknown;
  rpcError?: string | null;
  documentInsertError?: string | null;
  opInsertError?: string | null;
};

function buildEmitterService(options: EmitterMockOptions = {}) {
  const state: {
    scopeUpserts: Array<Record<string, unknown>>;
    documentInserts: Array<Record<string, unknown>>;
    opInserts: Array<Record<string, unknown>>;
    rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  } = {
    scopeUpserts: [],
    documentInserts: [],
    opInserts: [],
    rpcCalls: [],
  };

  const scopeTable = {
    upsert: vi.fn(async (payload: Record<string, unknown>) => {
      state.scopeUpserts.push(payload);
      return { data: null, error: null };
    }),
  };

  const documentSelectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options.existingDocumentId
        ? { id: options.existingDocumentId }
        : null,
      error: null,
    })),
  };

  const documentInsertSingle = vi.fn(async () => ({
    data: options.createdDocumentId ? { id: options.createdDocumentId } : null,
    error: options.documentInsertError ? { message: options.documentInsertError } : null,
  }));

  const documentsTable = {
    select: vi.fn(() => documentSelectChain),
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.documentInserts.push(payload);
      return {
        select: vi.fn(() => ({
          single: documentInsertSingle,
        })),
      };
    }),
  };

  const opsTable = {
    insert: vi.fn(async (payload: Record<string, unknown>) => {
      state.opInserts.push(payload);
      return {
        data: null,
        error: options.opInsertError ? { message: options.opInsertError } : null,
      };
    }),
  };

  const service = {
    from: vi.fn((table: string) => {
      if (table === "sync_scopes") return scopeTable;
      if (table === "crdt_documents") return documentsTable;
      if (table === "crdt_ops_log") return opsTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      return {
        data: options.rpcData ?? 1,
        error: options.rpcError ? { message: options.rpcError } : null,
      };
    }),
  };

  return { service, state };
}

describe("emitCrdtOperation", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  it("allocates scope sequence via RPC and inserts operation for existing documents", async () => {
    const mock = buildEmitterService({
      existingDocumentId: "doc-1",
      rpcData: [{ allocate_sync_scope_sequence: 7 }],
    });
    createServiceClientMock.mockReturnValue(mock.service);

    await emitCrdtOperation({
      scopeKey: "group:123",
      documentType: "messages",
      entityType: "message",
      entityId: "message-1",
      action: "create",
      payload: { content: "Hello" },
      clientId: "device-1",
    });

    expect(mock.state.scopeUpserts).toHaveLength(1);
    expect(mock.state.documentInserts).toHaveLength(0);
    expect(mock.state.rpcCalls).toEqual([
      {
        fn: "allocate_sync_scope_sequence",
        args: { p_scope_key: "group:123" },
      },
    ]);
    expect(mock.state.opInserts).toHaveLength(1);
    expect(mock.state.opInserts[0].document_id).toBe("doc-1");
    expect(mock.state.opInserts[0].sequence_no).toBe(7);
    expect(typeof mock.state.opInserts[0].op_data).toBe("string");
    expect((mock.state.opInserts[0].op_data as string).startsWith("\\x")).toBe(true);
  });

  it("creates the document before writing when the scope document is missing", async () => {
    const mock = buildEmitterService({
      existingDocumentId: null,
      createdDocumentId: "doc-created",
      rpcData: 11,
    });
    createServiceClientMock.mockReturnValue(mock.service);

    await emitCrdtOperation({
      scopeKey: "user:abc",
      documentType: "groups",
      entityType: "group",
      entityId: "group-1",
      action: "update",
      payload: { name: "North Park" },
    });

    expect(mock.state.documentInserts).toHaveLength(1);
    expect(mock.state.documentInserts[0]).toEqual({
      scope_key: "user:abc",
      document_type: "groups",
    });
    expect(mock.state.opInserts[0].document_id).toBe("doc-created");
    expect(mock.state.opInserts[0].sequence_no).toBe(11);
  });

  it("throws when allocator returns an invalid sequence", async () => {
    const mock = buildEmitterService({
      existingDocumentId: "doc-1",
      rpcData: 0,
    });
    createServiceClientMock.mockReturnValue(mock.service);

    await expect(() =>
      emitCrdtOperation({
        scopeKey: "group:bad-sequence",
        documentType: "messages",
        entityType: "message",
        entityId: "message-1",
        action: "create",
        payload: { content: "x" },
      }),
    ).rejects.toThrowError(/allocate scope sequence number/i);

    expect(mock.state.opInserts).toHaveLength(0);
  });

  it("bubbles allocator RPC errors", async () => {
    const mock = buildEmitterService({
      existingDocumentId: "doc-1",
      rpcError: "allocator failed",
    });
    createServiceClientMock.mockReturnValue(mock.service);

    await expect(() =>
      emitCrdtOperation({
        scopeKey: "group:rpc-error",
        documentType: "messages",
        entityType: "message",
        entityId: "message-2",
        action: "update",
        payload: { content: "x" },
      }),
    ).rejects.toThrowError(/allocator failed/i);

    expect(mock.state.opInserts).toHaveLength(0);
  });
});
