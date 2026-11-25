-- The GENESIS pass (genesis.tethos.ca, specs/genesis-pass.md). A guest pass is not an account: a row here plus a secret
-- the guest's phone keeps in a host-only cookie (only its hash is stored). RLS on and no policies on every table: only
-- genesis.tethos.ca's server routes (service role) read or write them.
create table if not exists public.genesis_passes (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null unique,
  name text check (char_length(name) <= 40),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- The front desk tap: one arrival per pass, the attendance count.
create table if not exists public.genesis_arrivals (
  pass_id uuid primary key references public.genesis_passes(id) on delete cascade,
  arrived_at timestamptz not null default now()
);

-- A booth sticker tapped: one stamp per pass and booth.
create table if not exists public.genesis_stamps (
  pass_id uuid not null references public.genesis_passes(id) on delete cascade,
  booth text not null,
  stamped_at timestamptz not null default now(),
  primary key (pass_id, booth)
);

alter table public.genesis_passes enable row level security;
alter table public.genesis_arrivals enable row level security;
alter table public.genesis_stamps enable row level security;
revoke all on public.genesis_passes, public.genesis_arrivals, public.genesis_stamps from anon, authenticated;
