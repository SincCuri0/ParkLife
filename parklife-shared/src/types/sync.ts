export type SyncScope = `user:${string}` | `group:${string}` | `map:cell:${string}`;

export interface CRDTOperation {
  sequence_no: number;
  op_data: string;
  client_id: string;
  created_at: string;
}

export interface SyncEnvelope {
  scope_key: SyncScope;
  checkpoint_lsn: number;
  next_checkpoint_lsn: number;
  operations: CRDTOperation[];
}

export interface SyncPullResponse {
  protocol: string;
  device_id: string;
  scopes: SyncEnvelope[];
  server_time: string;
}
