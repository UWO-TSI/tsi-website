-- 026_bounty_deliverables_rls.sql
-- Closes the Supabase "RLS disabled in public" critical advisory on the
-- legacy bounty_deliverables table (001-era; superseded by bounty_submissions
-- in 006). Nothing writes it; one API embeds it read-only, which now returns
-- an empty set for non-service roles. Deny-all by design: no policies added.
-- Flagged in AGENT_LOG "Blocked / Needs Attention" 2026-07-03; David approved
-- enabling RLS 2026-09-02.

ALTER TABLE IF EXISTS public.bounty_deliverables ENABLE ROW LEVEL SECURITY;
