-- The Luma guest list for GENESIS (specs/genesis-pass.md), loaded from Luma's CSV export by staff on /staff. A guest who
-- saves their pass with the email they registered with is matched: the pass gets their name if it has none, and the
-- numbers split registered from walk-in. RLS on, no policies: server only.
create table if not exists public.genesis_registrations (
  email text primary key check (email = lower(email)),
  name text check (char_length(name) <= 80),
  pass_id uuid unique references public.genesis_passes(id) on delete set null,
  imported_at timestamptz not null default now()
);
alter table public.genesis_registrations enable row level security;
revoke all on public.genesis_registrations from anon, authenticated;
