-- Run only after the tested website and recruitment_delivery migration are live.
-- Store the deployed origin and matching CRON_SECRET in Supabase Vault first:
--   recruitment_sheet_origin: https://www.tethos.ca
--   recruitment_sheet_cron_secret: same value as the Vercel CRON_SECRET
-- Never put a secret literal into this checked-in file.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='recruitment_sheet_origin')
    or not exists(select 1 from vault.decrypted_secrets where name='recruitment_sheet_cron_secret') then
    raise exception 'Set recruitment_sheet_origin and recruitment_sheet_cron_secret in Vault before scheduling';
  end if;
end $$;

-- Every 5 minutes (was every minute until 2026-09-18: pg_cron's own run-history
-- writes were the heaviest statements on the free-tier instance). The app also
-- syncs right after each write, so this is only the safety net.
select cron.schedule('recruitment-sheet-delivery', '*/5 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='recruitment_sheet_origin') || '/api/sheets-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='recruitment_sheet_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) where exists(select 1 from public.recruitment_sheet_rows where synced_at is null)
    and exists(select 1 from public.recruitment_sheet_state where next_attempt_at <= now()
      and (lease_until is null or lease_until < now()));
$job$);

-- pg_cron keeps every run in cron.job_run_details; prune it daily (applied 2026-09-18).
select cron.schedule('prune-cron-history', '17 4 * * *', $job$
  delete from cron.job_run_details where start_time < now() - interval '2 days'
$job$);
