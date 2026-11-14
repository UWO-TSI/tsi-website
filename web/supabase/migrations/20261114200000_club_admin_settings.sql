-- Club admin (tethos.ca/admin) settings, one row per setting: first the Google Sheet that event check-ins are copied
-- to (key 'attendance_sheet', value the spreadsheet id). Server only: RLS on, no policies, so only the service role
-- reads or writes it.
create table if not exists public.club_admin_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.club_admin_settings enable row level security;
