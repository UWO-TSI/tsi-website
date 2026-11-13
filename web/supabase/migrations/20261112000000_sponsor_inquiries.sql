-- Sponsor inquiries from the short form on /genesis. Sponsors have no accounts, so the public never reads or
-- writes this table directly: POST /api/sponsor-inquiries inserts with the service role and emails the
-- sponsorship leads. RLS is on with no policies.

create table if not exists public.sponsor_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 160),
  organization text not null check (char_length(organization) between 1 and 200),
  email text not null check (char_length(email) between 3 and 254),
  interests text[] not null default '{}' check (interests <@ array['recognition', 'hiring', 'stage', 'unsure']::text[]),
  message text check (message is null or char_length(message) <= 2000),
  -- Test rows from preview deployments and local dev.
  preview boolean not null default false,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  notified_at timestamptz
);

create index if not exists sponsor_inquiries_created_at_idx on public.sponsor_inquiries (created_at desc);
create index if not exists sponsor_inquiries_email_created_idx on public.sponsor_inquiries (email, created_at desc);

alter table public.sponsor_inquiries enable row level security;
