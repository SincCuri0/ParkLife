import { structuredLog } from "@/lib/api/observability";

export async function adaptedWrite<T>(
  relationalWrite: () => Promise<T>,
  crdtEmit: (result: T) => Promise<void>,
): Promise<T> {
  const result = await relationalWrite();
  try {
    await crdtEmit(result);
  } catch (error) {
    structuredLog("warn", {
      event: "sync.crdt_emit_failed",
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
  return result;
}
