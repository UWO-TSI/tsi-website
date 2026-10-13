-- Final round prank: one row per invite link, tracking how far each person got.
-- Server-only: RLS on with no policies; written through finalround_track by the service role.

create table if not exists public.finalround_progress (
  id text primary key,
  name text not null,
  project text not null default '',
  opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  revealed_at timestamptz
);

alter table public.finalround_progress enable row level security;

create or replace function public.finalround_track(p_id text, p_name text, p_project text, p_event text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into finalround_progress (id, name, project, opened_at, last_opened_at, open_count, started_at, finished_at, revealed_at)
  values (
    p_id, p_name, p_project,
    case when p_event = 'open' then now() end,
    case when p_event = 'open' then now() end,
    case when p_event = 'open' then 1 else 0 end,
    case when p_event = 'start' then now() end,
    case when p_event = 'finish' then now() end,
    case when p_event = 'reveal' then now() end
  )
  on conflict (id) do update set
    opened_at = coalesce(finalround_progress.opened_at, excluded.opened_at),
    last_opened_at = coalesce(excluded.last_opened_at, finalround_progress.last_opened_at),
    open_count = finalround_progress.open_count + excluded.open_count,
    started_at = coalesce(finalround_progress.started_at, excluded.started_at),
    finished_at = coalesce(finalround_progress.finished_at, excluded.finished_at),
    revealed_at = coalesce(finalround_progress.revealed_at, excluded.revealed_at);
$$;

revoke all on function public.finalround_track(text, text, text, text) from public, anon, authenticated;
