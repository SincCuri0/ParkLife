-- ParkLife message relay table for mobile outbox sync
-- Generated: 2026-02-22

create table if not exists messages (
  id text primary key,
  conversation_id text not null,
  sender_id uuid references profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation_created
  on messages(conversation_id, created_at desc);

create index if not exists idx_messages_sender_created
  on messages(sender_id, created_at desc);
