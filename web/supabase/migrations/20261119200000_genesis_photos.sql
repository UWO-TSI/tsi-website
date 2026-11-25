-- GENESIS photobooth photos (specs/genesis-pass.md). The booth laptop makes the short id (so the receipt prints before the
-- upload lands), uploads the colour photo to the private genesis-photos bucket, and records it here. Opening the QR saves
-- the photo to the guest's pass. RLS on, no policies: only the server (service role) reads or writes.
create table if not exists public.genesis_photos (
  id text primary key check (id ~ '^[a-z0-9]{10}$'),
  path text not null,
  taken_by uuid references auth.users(id) on delete set null,
  taken_at timestamptz not null default now()
);

create table if not exists public.genesis_photo_saves (
  pass_id uuid not null references public.genesis_passes(id) on delete cascade,
  photo_id text not null references public.genesis_photos(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (pass_id, photo_id)
);

alter table public.genesis_photos enable row level security;
alter table public.genesis_photo_saves enable row level security;
revoke all on public.genesis_photos, public.genesis_photo_saves from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('genesis-photos', 'genesis-photos', false, 8388608, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;
