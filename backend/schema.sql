-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create extension if not exists pgcrypto;

-- ── Users ────────────────────────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Invitations ──────────────────────────────────────────────────────────────
create table if not exists invitations (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  role       text not null default 'member' check (role in ('admin', 'member')),
  token      text not null unique,
  invited_by uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,                       -- null = not yet used
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invitations_email_idx on invitations (email);

-- ── Password reset tokens ────────────────────────────────────────────────────
create table if not exists reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reset_tokens_user_id_idx on reset_tokens (user_id);

-- The backend connects as the postgres role, so it bypasses RLS. Enabling RLS
-- with no policies blocks access through Supabase's public REST API.
alter table users        enable row level security;
alter table invitations  enable row level security;
alter table reset_tokens enable row level security;

-- ── Decisions (AI investment decision ledger) ────────────────────────────────
create table if not exists decisions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  org          text not null check (org in ('cto', 'cio', 'cpo')),
  tier         int  not null check (tier between 1 and 4),
  monthly_cost numeric not null check (monthly_cost >= 0),
  org_budget   numeric not null check (org_budget >= 0),
  scores       jsonb not null,                  -- { value, fit, reversibility, adoption }
  composite    int  not null,
  verdict      text not null check (verdict in ('INVEST', 'PILOT', 'HOLD', 'DECLINE')),
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists decisions_created_at_idx on decisions (created_at desc);
alter table decisions enable row level security;
