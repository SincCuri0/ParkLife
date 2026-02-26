import { createServiceClient } from "@/lib/supabase/server";

interface EmitCrdtOperationParams {
  scopeKey: string;
  documentType: string;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  payload: unknown;
  clientId?: string;
}

function encodeOperationData(value: unknown) {
  const json = JSON.stringify(value);
  return `\\x${Buffer.from(json, "utf8").toString("hex")}`;
}

async function allocateScopeSequenceNo(
  service: ReturnType<typeof createServiceClient>,
  scopeKey: string,
) {
  const { data, error } = await service.rpc("allocate_sync_scope_sequence", {
    p_scope_key: scopeKey,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rawValue = Array.isArray(data)
    ? data[0]
    : data;

  const sequenceNo = Number(
    rawValue && typeof rawValue === "object"
      ? (rawValue as { allocate_sync_scope_sequence?: unknown }).allocate_sync_scope_sequence
      : rawValue,
  );

  if (!Number.isFinite(sequenceNo) || sequenceNo <= 0) {
    throw new Error("Could not allocate scope sequence number");
  }

  return sequenceNo;
}

export async function emitCrdtOperation(params: EmitCrdtOperationParams) {
  const service = createServiceClient();
  const clientId = params.clientId || "server";

  await service
    .from("sync_scopes")
    .upsert({ scope_key: params.scopeKey }, { onConflict: "scope_key" });

  let documentId: string;
  const { data: existingDocument } = await service
    .from("crdt_documents")
    .select("id")
    .eq("scope_key", params.scopeKey)
    .eq("document_type", params.documentType)
    .maybeSingle();

  if (existingDocument?.id) {
    documentId = existingDocument.id;
  } else {
    const { data: createdDocument, error: documentError } = await service
      .from("crdt_documents")
      .insert({
        scope_key: params.scopeKey,
        document_type: params.documentType,
      })
      .select("id")
      .single();

    if (documentError || !createdDocument) {
      throw new Error(documentError?.message || "Could not create CRDT document");
    }
    documentId = createdDocument.id;
  }

  // Checkpoints are tracked per scope, so sequence numbers must advance atomically per scope.
  const sequenceNo = await allocateScopeSequenceNo(service, params.scopeKey);
  const { error: insertError } = await service.from("crdt_ops_log").insert({
    document_id: documentId,
    op_data: encodeOperationData({
      document_type: params.documentType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      payload: params.payload,
      timestamp: new Date().toISOString(),
    }),
    client_id: clientId,
    sequence_no: sequenceNo,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function emitTombstone(entityType: string, entityId: string, deletedBy?: string | null) {
  const service = createServiceClient();
  const { error } = await service.from("sync_tombstones").insert({
    entity_type: entityType,
    entity_id: entityId,
    deleted_by: deletedBy || null,
  });

  if (error) {
    throw new Error(error.message);
  }
}
