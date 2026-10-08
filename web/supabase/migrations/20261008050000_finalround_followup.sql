-- Final round prank: contact details for the automatic onboarding email.
-- Rows are seeded per invite (email + CC list); followup_sent_at makes the send once-only.

alter table public.finalround_progress
  add column if not exists email text,
  add column if not exists cc text[] not null default '{}',
  add column if not exists followup_sent_at timestamptz;
