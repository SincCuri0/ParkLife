-- ParkLife sync plane migration (Phase 2 + idempotency baseline)

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  device_fingerprint text not null,
  platform text not null check (platform in ('web', 'ios', 'android')),
  protocol_version text not null,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (user_id, device_fingerprint)
);

create table if not exists sync_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  created_at timestamptz default now()
);

create table if not exists sync_checkpoints (
  device_id uuid references devices(id) on delete cascade,
  scope_key text not null,
  checkpoint_lsn bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (device_id, scope_key)
);

create table if not exists sync_tombstones (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  deleted_at timestamptz default now(),
  deleted_by uuid references profiles(id)
);

create table if not exists crdt_documents (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null,
  document_type text not null,
  created_at timestamptz default now()
);

create table if not exists crdt_ops_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references crdt_documents(id) on delete cascade,
  op_data bytea not null,
  client_id text not null,
  sequence_no bigint not null,
  created_at timestamptz default now(),
  unique (document_id, sequence_no)
);

create table if not exists request_dedup (
  idempotency_key text primary key,
  response_body jsonb not null,
  status_code integer not null default 200,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

create index if not exists idx_devices_user_id on devices(user_id);
create index if not exists idx_sync_checkpoints_scope_key on sync_checkpoints(scope_key);
create index if not exists idx_sync_tombstones_entity on sync_tombstones(entity_type, entity_id);
create index if not exists idx_crdt_documents_scope_key on crdt_documents(scope_key);
create index if not exists idx_crdt_ops_document_sequence on crdt_ops_log(document_id, sequence_no);
create index if not exists idx_request_dedup_expires_at on request_dedup(expires_at);
