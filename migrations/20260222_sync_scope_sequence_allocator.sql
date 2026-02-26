-- Atomic scope-level CRDT sequence allocator.
-- Ensures sequence_no monotonicity is enforced per scope under concurrent writers.

create table if not exists sync_scope_sequences (
  scope_key text primary key references sync_scopes(scope_key) on delete cascade,
  next_sequence_no bigint not null default 1,
  updated_at timestamptz default now()
);

create or replace function allocate_sync_scope_sequence(p_scope_key text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  allocated bigint;
begin
  if p_scope_key is null or btrim(p_scope_key) = '' then
    raise exception 'scope_key is required';
  end if;

  insert into sync_scopes (scope_key)
  values (p_scope_key)
  on conflict (scope_key) do nothing;

  insert into sync_scope_sequences (scope_key, next_sequence_no, updated_at)
  values (p_scope_key, 2, now())
  on conflict (scope_key)
  do update
    set next_sequence_no = sync_scope_sequences.next_sequence_no + 1,
        updated_at = now()
  returning next_sequence_no - 1 into allocated;

  return allocated;
end;
$$;

