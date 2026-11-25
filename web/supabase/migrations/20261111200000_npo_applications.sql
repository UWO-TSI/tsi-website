-- Nonprofit applications from the form on /npo (specs/site/revamp.md). Nonprofits have no accounts, so
-- the public never reads or writes these tables directly: POST /api/npo-applications inserts with the
-- service role, and /admin/npo reads with it. RLS is on with no policies.

create table if not exists public.npo_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- The program year the application is for ("2027-28"), or "preview" for test rows from preview deployments.
  cycle text not null,
  org_name text not null check (char_length(org_name) between 1 and 200),
  website text check (website is null or char_length(website) <= 300),
  org_type text not null check (org_type in ('registered_charity', 'nonprofit', 'social_enterprise', 'other')),
  city text check (city is null or char_length(city) <= 120),
  contact_name text not null check (char_length(contact_name) between 1 and 160),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  contact_role text check (contact_role is null or char_length(contact_role) <= 160),
  problem text not null check (char_length(problem) between 1 and 4000),
  users text check (users is null or char_length(users) <= 2000),
  current_tools text check (current_tools is null or char_length(current_tools) <= 2000),
  can_commit boolean not null default false,
  heard_about text check (heard_about is null or char_length(heard_about) <= 200),
  status text not null default 'new' check (status in ('new', 'reviewing', 'selected', 'declined')),
  sheet_synced_at timestamptz
);

create index if not exists npo_applications_created_at_idx on public.npo_applications (created_at desc);
create index if not exists npo_applications_email_created_idx on public.npo_applications (lower(contact_email), created_at desc);

alter table public.npo_applications enable row level security;

-- The Google Sheet the applications are copied into, created on the first submission.
create table if not exists public.npo_sheet_state (
  id boolean primary key default true check (id),
  spreadsheet_id text,
  updated_at timestamptz not null default now()
);

alter table public.npo_sheet_state enable row level security;
