-- Park Pound ledger migration (Phase 8, behind PARK_POUND_ENABLED)

create table if not exists park_pound_ledgers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references groups(id),
  user_id uuid references profiles(id),
  balance bigint not null default 0,
  unique (community_id, user_id)
);

create table if not exists park_pound_transactions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references groups(id),
  from_user_id uuid references profiles(id),
  to_user_id uuid references profiles(id),
  amount bigint not null,
  reason text not null,
  transaction_type text not null check (
    transaction_type in ('node_hosting', 'help_completed', 'tip', 'moderation', 'participation')
  ),
  reference_id uuid,
  created_at timestamptz default now()
);

create index if not exists idx_park_pound_transactions_community_created
  on park_pound_transactions(community_id, created_at desc);
