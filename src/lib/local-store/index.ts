import { structuredLog } from "@/lib/api/observability";
import { featureFlags, runtimeConfig } from "@/lib/env";
import type { CRDTOperation as SyncPullOperation, SyncPullResponse } from "../../../parklife-shared/src/types/sync";

type ScopeDocumentCache = {
  doc: import("yjs").Doc;
  ready: Promise<void>;
};

const STORE_PREFIX = "parklife-sync";
const CHECKPOINT_STORAGE_KEY = "parklife.sync.checkpoints";
const DEVICE_ID_STORAGE_KEY = "parklife.sync.device_id";
const DEVICE_FINGERPRINT_STORAGE_KEY = "parklife.sync.device_fingerprint";
const scopeCache = new Map<string, ScopeDocumentCache>();

function isBrowser() {
  return typeof window !== "undefined";
}

function getScopeStoreName(scopeKey: string) {
  return `${STORE_PREFIX}:${scopeKey}`;
}

function decodeHexPayload(value: string) {
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

function getDocumentMap(doc: import("yjs").Doc, documentType: string) {
  return doc.getMap<unknown>(`doc:${documentType}`);
}

function readCheckpointMap() {
  if (!isBrowser()) return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeCheckpointMap(value: Record<string, number>) {
  if (!isBrowser()) return;
  window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(value));
}

export function getCheckpoint(scopeKey: string) {
  const checkpoints = readCheckpointMap();
  return checkpoints[scopeKey] || 0;
}

export function setCheckpoint(scopeKey: string, lsn: number) {
  const checkpoints = readCheckpointMap();
  checkpoints[scopeKey] = lsn;
  writeCheckpointMap(checkpoints);
}

function getOrCreateDeviceFingerprint() {
  if (!isBrowser()) return "server";
  const existing = window.localStorage.getItem(DEVICE_FINGERPRINT_STORAGE_KEY);
  if (existing) return existing;
  const generated = window.crypto.randomUUID();
  window.localStorage.setItem(DEVICE_FINGERPRINT_STORAGE_KEY, generated);
  return generated;
}

async function ensureScope(scopeKey: string): Promise<ScopeDocumentCache> {
  if (!isBrowser()) {
    throw new Error("Local store is only available in browser context");
  }

  const cached = scopeCache.get(scopeKey);
  if (cached) return cached;

  const Y = await import("yjs");
  const { IndexeddbPersistence } = await import("y-indexeddb");
  const doc = new Y.Doc();
  const provider = new IndexeddbPersistence(getScopeStoreName(scopeKey), doc);
  const ready = new Promise<void>((resolve) => {
    if (provider.synced) {
      resolve();
      return;
    }
    provider.once("synced", () => resolve());
  });

  const created = { doc, ready };
  scopeCache.set(scopeKey, created);
  return created;
}

export async function upsertRecordsByScope<T extends { id: string }>(
  scopeKey: string,
  documentType: string,
  records: T[],
) {
  const scope = await ensureScope(scopeKey);
  await scope.ready;
  const map = getDocumentMap(scope.doc, documentType);
  for (const record of records) {
    map.set(record.id, record);
  }
}

export async function hydrateMergedRecords<T extends { id: string }>(
  scopeKeys: string[],
  documentType: string,
) {
  const merged = new Map<string, T>();
  const scopes = await Promise.all(
    scopeKeys.map(async (scopeKey) => {
      const scope = await ensureScope(scopeKey);
      await scope.ready;
      return scope;
    }),
  );

  for (const scope of scopes) {
    const map = getDocumentMap(scope.doc, documentType);
    map.forEach((value, key) => {
      if (!value || typeof value !== "object") return;
      const typed = value as T;
      merged.set(String(key), typed);
    });
  }
  return Array.from(merged.values());
}

function decodeOperation(opData: string) {
  try {
    const decoded = decodeHexPayload(opData);
    return JSON.parse(decoded) as {
      document_type?: string;
      entity_type?: string;
      entity_id: string;
      action: "create" | "update" | "delete";
      payload: unknown;
    };
  } catch {
    return null;
  }
}

export async function applySyncOperations(scopeKey: string, operations: SyncPullOperation[]) {
  if (operations.length === 0) return;
  const scope = await ensureScope(scopeKey);
  await scope.ready;

  for (const operation of operations) {
    const decoded = decodeOperation(operation.op_data);
    if (!decoded) continue;
    const documentType = decoded.document_type || `${decoded.entity_type || "entities"}s`;
    const map = getDocumentMap(scope.doc, documentType);

    if (decoded.action === "delete") {
      map.delete(decoded.entity_id);
      continue;
    }

    const payload =
      decoded.payload && typeof decoded.payload === "object"
        ? { id: decoded.entity_id, ...(decoded.payload as Record<string, unknown>) }
        : { id: decoded.entity_id };
    map.set(decoded.entity_id, payload);
  }
}

export async function reconcileScopes(scopeKeys: string[]) {
  if (!isBrowser() || !featureFlags.syncV2Enabled) return;
  const uniqueScopes = Array.from(new Set(scopeKeys));
  if (uniqueScopes.length === 0) return;

  const url = new URL("/api/sync/pull", window.location.origin);
  uniqueScopes.forEach((scope) => url.searchParams.append("scope", scope));

  const headers = new Headers({
    "X-ParkLife-Protocol": runtimeConfig.protocolVersion,
    "X-Device-Fingerprint": getOrCreateDeviceFingerprint(),
    "X-Device-Platform": "web",
  });

  const storedDeviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (storedDeviceId) {
    headers.set("X-Device-Id", storedDeviceId);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    structuredLog("warn", {
      event: "local_store.sync_pull_failed",
      status: response.status,
    });
    return;
  }

  const payload = await response.json() as Partial<SyncPullResponse>;

  if (typeof payload.device_id === "string" && payload.device_id) {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, payload.device_id);
  }

  for (const scope of payload.scopes || []) {
    await applySyncOperations(scope.scope_key, scope.operations || []);
    setCheckpoint(scope.scope_key, Number(scope.next_checkpoint_lsn || 0));
  }
}
