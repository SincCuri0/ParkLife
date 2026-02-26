-- ParkLife presence + assistant privacy migration (Phases 5, 6, 7)

create table if not exists presence_events (
  id uuid primary key default gen_random_uuid(),
  geohash_5 text not null,
  event_type text not null check (event_type in ('active', 'node_hosting')),
  created_at timestamptz default now()
);

create index if not exists idx_presence_events_window
  on presence_events (created_at desc, geohash_5, event_type);

create materialized view if not exists heatmap_cells_5m as
select
  geohash_5,
  count(*) as activity_count,
  max(created_at) as last_active
from presence_events
where created_at > now() - interval '30 minutes'
group by geohash_5;

create unique index if not exists idx_heatmap_cells_5m_geohash
  on heatmap_cells_5m (geohash_5);

create table if not exists lamp_presence (
  user_id uuid primary key references profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz default now()
);

create index if not exists idx_lamp_presence_updated_at on lamp_presence(updated_at desc);

alter table profiles
  add column if not exists ai_data_sharing jsonb default '{
    "location": false,
    "group_memberships": false,
    "pin_history": false,
    "activity_patterns": false,
    "calendar": false
  }'::jsonb;

alter table profiles
  add column if not exists lamp_visibility_enabled boolean default false;

create table if not exists assistant_action_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action_type text not null,
  payload jsonb not null,
  confirmation_token text unique,
  token_expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists assistant_action_commits (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references assistant_action_requests(id) on delete cascade,
  success boolean not null,
  result jsonb,
  committed_at timestamptz default now(),
  unique (request_id)
);

create index if not exists idx_assistant_action_requests_user_created
  on assistant_action_requests(user_id, created_at desc);
