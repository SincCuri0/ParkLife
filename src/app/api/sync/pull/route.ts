import { NextResponse } from "next/server";
import { featureFlags, runtimeConfig } from "@/lib/env";
import { getRequestUser } from "@/lib/api/request-user";
import { createServiceClient } from "@/lib/supabase/server";
import { getProtocolVersionFromRequest, isSupportedProtocol } from "@/lib/sync/protocol";
import { isSyncScopeAuthorized, parseSyncPullScopes } from "./helpers";

type SyncOpRow = {
  sequence_no: number;
  op_data: string;
  client_id: string;
  created_at: string;
};

export async function GET(request: Request) {
  if (!featureFlags.syncV2Enabled) {
    return NextResponse.json({ error: "Sync v2 is disabled" }, { status: 404 });
  }

  const requestedProtocol = getProtocolVersionFromRequest(request);
  if (!isSupportedProtocol(requestedProtocol)) {
    return NextResponse.json(
      {
        error: "Unsupported protocol version",
        expected: runtimeConfig.protocolVersion,
      },
      { status: 400 },
    );
  }

  const deviceFingerprint = request.headers.get("x-device-fingerprint")?.trim();
  if (!deviceFingerprint) {
    return NextResponse.json(
      { error: "Missing x-device-fingerprint header" },
      { status: 400 },
    );
  }

  const platform = request.headers.get("x-device-platform")?.trim() || "web";
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let scopes: string[];
  try {
    scopes = parseSyncPullScopes(new URL(request.url));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid scopes" },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: memberships } = await service
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(500);

  const memberGroupIds = new Set((memberships || []).map((row) => row.group_id));
  const unauthorizedScopes = scopes.filter((scopeKey) => (
    !isSyncScopeAuthorized(scopeKey, user.id, memberGroupIds)
  ));

  if (unauthorizedScopes.length > 0) {
    return NextResponse.json(
      {
        error: "Unauthorized scope access",
        scopes: unauthorizedScopes,
      },
      { status: 403 },
    );
  }

  let deviceId = request.headers.get("x-device-id")?.trim() || null;
  if (deviceId) {
    const { data: existing } = await service
      .from("devices")
      .select("id")
      .eq("id", deviceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) {
      deviceId = null;
    }
  }

  if (!deviceId) {
    const { data: upsertedDevice, error: deviceError } = await service
      .from("devices")
      .upsert(
        {
          user_id: user.id,
          device_fingerprint: deviceFingerprint,
          platform,
          protocol_version: runtimeConfig.protocolVersion,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_fingerprint" },
      )
      .select("id")
      .single();

    if (deviceError || !upsertedDevice) {
      return NextResponse.json(
        { error: deviceError?.message || "Could not register device" },
        { status: 500 },
      );
    }

    deviceId = upsertedDevice.id;
  } else {
    await service
      .from("devices")
      .update({
        last_seen_at: new Date().toISOString(),
        protocol_version: runtimeConfig.protocolVersion,
      })
      .eq("id", deviceId);
  }

  const results: Array<{
    scope_key: string;
    checkpoint_lsn: number;
    next_checkpoint_lsn: number;
    operations: SyncOpRow[];
  }> = [];

  for (const scopeKey of scopes) {
    const { data: checkpointRow } = await service
      .from("sync_checkpoints")
      .select("checkpoint_lsn")
      .eq("device_id", deviceId)
      .eq("scope_key", scopeKey)
      .maybeSingle();

    const checkpoint = Number(checkpointRow?.checkpoint_lsn || 0);

    const { data: documents } = await service
      .from("crdt_documents")
      .select("id")
      .eq("scope_key", scopeKey)
      .limit(100);

    const documentIds = (documents || []).map((row) => row.id);
    let ops: SyncOpRow[] = [];

    if (documentIds.length > 0) {
      const { data: opRows, error: opError } = await service
        .from("crdt_ops_log")
        .select("sequence_no, op_data, client_id, created_at")
        .in("document_id", documentIds)
        .gt("sequence_no", checkpoint)
        .order("sequence_no", { ascending: true })
        .limit(1000);

      if (opError) {
        return NextResponse.json({ error: opError.message }, { status: 500 });
      }
      ops = (opRows || []) as SyncOpRow[];
    }

    const nextCheckpoint = ops.length > 0
      ? ops[ops.length - 1].sequence_no
      : checkpoint;

    results.push({
      scope_key: scopeKey,
      checkpoint_lsn: checkpoint,
      next_checkpoint_lsn: nextCheckpoint,
      operations: ops,
    });

    if (nextCheckpoint > checkpoint) {
      await service.from("sync_checkpoints").upsert({
        device_id: deviceId,
        scope_key: scopeKey,
        checkpoint_lsn: nextCheckpoint,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({
    protocol: runtimeConfig.protocolVersion,
    device_id: deviceId,
    scopes: results,
    server_time: new Date().toISOString(),
  });
}
