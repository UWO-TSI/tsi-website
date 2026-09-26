-- Smoke test for 20260926130000_portal_rls_hardening.sql.
-- Throwaway local Postgres 16 only (never a Supabase project):
--   psql -f web/supabase/tests/supabase_stub.sql
--   psql -f each web/supabase/migrations/*.sql in name order (the legacy chain
--        has known statement errors in 020's achievements section; unrelated)
--   psql -f web/supabase/tests/portal_rls_smoke.sql
-- Every check raises (and ON_ERROR_STOP aborts) on failure.
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
\o /dev/null

-- Two assertion helpers, callable from every role.
CREATE SCHEMA smoke;
GRANT USAGE ON SCHEMA smoke TO anon, authenticated, service_role;
CREATE FUNCTION smoke.denied(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'FAIL: % was allowed', label;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok: % denied', label;
END $$;
CREATE FUNCTION smoke.rows(label text, stmt text, expected int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> expected THEN
    RAISE EXCEPTION 'FAIL: % touched % rows, expected %', label, n, expected;
  END IF;
  RAISE NOTICE 'ok: % (% rows)', label, n;
END $$;

-- ─── Seed as postgres ────────────────────────────────────────────────────────
-- a: T4 member on team X · b: T4 with no team (an applicant) · d: T3 staff · c: T1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-00000000000a', 'a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.test'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.test'),
  ('00000000-0000-4000-8000-00000000000d', 'd@example.test');
INSERT INTO teams (id, name, side, term) VALUES ('10000000-0000-4000-8000-000000000001', 'X', 'projects', '2026-27');
UPDATE profiles SET team_id = '10000000-0000-4000-8000-000000000001' WHERE id = '00000000-0000-4000-8000-00000000000a';
UPDATE profiles SET tier = 1 WHERE id = '00000000-0000-4000-8000-00000000000c';
UPDATE profiles SET tier = 3 WHERE id = '00000000-0000-4000-8000-00000000000d';

INSERT INTO kanban_boards (id, team_id, name) VALUES ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'X board');
INSERT INTO kanban_columns (id, board_id, name, position) VALUES ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Todo', 0);
INSERT INTO kanban_cards (id, column_id, title, position) VALUES ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'Card', 0);
INSERT INTO kanban_card_labels (id, card_id, label) VALUES ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', 'bug');
INSERT INTO kanban_card_checklist (id, card_id, title, position) VALUES ('10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', 'step', 0);

INSERT INTO announcements (id, title, body) VALUES ('20000000-0000-4000-8000-000000000001', 'Hi', 'body');
INSERT INTO events (id, title, event_type, start_time) VALUES ('20000000-0000-4000-8000-000000000002', 'Social', 'social', now());
INSERT INTO quests (id, title, description, quest_type) VALUES ('20000000-0000-4000-8000-000000000003', 'Q', 'q', 'daily');
INSERT INTO marketplace_items (id, name, price_tc, stock) VALUES ('20000000-0000-4000-8000-000000000004', 'Hoodie', 500, 10);
INSERT INTO marketplace_orders (id, user_id, item_id, total_tc) VALUES
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-000000000004', 500);
INSERT INTO bounties (id, title, description, status) VALUES ('20000000-0000-4000-8000-000000000006', 'B', 'b', 'open');
INSERT INTO job_listings (id, title, company, job_type, url, posted_by) VALUES
  ('20000000-0000-4000-8000-000000000007', 'SWE', 'Co', 'internship', 'https://x.test', '00000000-0000-4000-8000-00000000000a');
INSERT INTO mentorship_matches (id, mentor_id, mentee_id) VALUES
  ('20000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b');
INSERT INTO portfolios (id, user_id, slug) VALUES
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-00000000000a', 'a'),
  ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', 'b');
INSERT INTO portfolio_items (id, portfolio_id, type, title) VALUES
  ('20000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-000000000009', 'project', 'A item');

-- ─── b: T4, no team (what every applicant is) ───────────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
SELECT smoke.denied('T4 insert announcement', $q$INSERT INTO announcements (title, body) VALUES ('x', 'x')$q$);
SELECT smoke.rows('T4 update announcement', $q$UPDATE announcements SET title = 'pwned'$q$, 0);
SELECT smoke.rows('T4 delete announcement', $q$DELETE FROM announcements$q$, 0);
SELECT smoke.denied('T4 insert event', $q$INSERT INTO events (title, event_type, start_time, xp_reward) VALUES ('x', 'social', now(), 9999)$q$);
SELECT smoke.rows('T4 update event', $q$UPDATE events SET xp_reward = 9999$q$, 0);
SELECT smoke.denied('T4 insert quest', $q$INSERT INTO quests (title, description, quest_type) VALUES ('x', 'x', 'daily')$q$);
SELECT smoke.rows('T4 update quest', $q$UPDATE quests SET tc_reward = 9999$q$, 0);
SELECT smoke.rows('T4 delete quest', $q$DELETE FROM quests$q$, 0);
SELECT smoke.denied('T4 insert shop item', $q$INSERT INTO marketplace_items (name, price_tc) VALUES ('x', 0)$q$);
SELECT smoke.rows('T4 reprice shop item', $q$UPDATE marketplace_items SET price_tc = 0$q$, 0);
SELECT smoke.rows('T4 delete shop item', $q$DELETE FROM marketplace_items$q$, 0);
SELECT smoke.denied('T4 free order for self', $q$INSERT INTO marketplace_orders (user_id, item_id, total_tc)
  VALUES ('00000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-000000000004', 0)$q$);
SELECT smoke.rows('T4 update any order', $q$UPDATE marketplace_orders SET status = 'fulfilled'$q$, 0);
SELECT smoke.denied('T4 insert own TC ledger row', $q$INSERT INTO tc_transactions (user_id, amount, balance_after, type)
  VALUES ('00000000-0000-4000-8000-00000000000b', 99999, 99999, 'earn_admin')$q$);
SELECT smoke.denied('T4 insert own XP ledger row', $q$INSERT INTO xp_transactions (user_id, amount, type)
  VALUES ('00000000-0000-4000-8000-00000000000b', 99999, 'event')$q$);
SELECT smoke.denied('T4 notify another member', $q$INSERT INTO notifications (user_id, type, title)
  VALUES ('00000000-0000-4000-8000-00000000000a', 'x', 'phish')$q$);
SELECT smoke.rows('T4 propose bounty (pending)', $q$INSERT INTO bounties (title, description, submitted_by)
  VALUES ('mine', 'x', '00000000-0000-4000-8000-00000000000b')$q$, 1);
SELECT smoke.denied('T4 insert open bounty', $q$INSERT INTO bounties (title, description, submitted_by, status)
  VALUES ('x', 'x', '00000000-0000-4000-8000-00000000000b', 'open')$q$);
SELECT smoke.denied('T4 self-approved bounty', $q$INSERT INTO bounties (title, description, submitted_by, approved_by)
  VALUES ('x', 'x', '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b')$q$);
SELECT smoke.denied('T4 bounty as someone else', $q$INSERT INTO bounties (title, description, submitted_by)
  VALUES ('x', 'x', '00000000-0000-4000-8000-00000000000a')$q$);
SELECT smoke.rows('T4 update bounty (incl. own)', $q$UPDATE bounties SET status = 'completed', pay_tc = 99999$q$, 0);
SELECT smoke.rows('T4 post job as self', $q$INSERT INTO job_listings (title, company, job_type, url, posted_by)
  VALUES ('x', 'x', 'internship', 'https://x.test', '00000000-0000-4000-8000-00000000000b')$q$, 1);
SELECT smoke.denied('T4 post job as someone else', $q$INSERT INTO job_listings (title, company, job_type, url, posted_by)
  VALUES ('x', 'x', 'internship', 'https://x.test', '00000000-0000-4000-8000-00000000000a')$q$);
SELECT smoke.rows('T4 edit job listings', $q$UPDATE job_listings SET url = 'https://evil.test'$q$, 0);
SELECT smoke.rows('T4 delete job listings', $q$DELETE FROM job_listings$q$, 0);
SELECT smoke.rows('mentee requests mentor (pending)', $q$INSERT INTO mentorship_matches (mentor_id, mentee_id)
  VALUES ('00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000b')$q$, 1);
SELECT smoke.denied('mentee inserts active match', $q$INSERT INTO mentorship_matches (mentor_id, mentee_id, status)
  VALUES ('00000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-00000000000b', 'active')$q$);
SELECT smoke.denied('match with someone else as mentee', $q$INSERT INTO mentorship_matches (mentor_id, mentee_id)
  VALUES ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000a')$q$);
SELECT smoke.rows('mentee self-accepts', $q$UPDATE mentorship_matches SET status = 'active'$q$, 0);
SELECT smoke.denied('add item to another portfolio', $q$INSERT INTO portfolio_items (portfolio_id, type, title)
  VALUES ('20000000-0000-4000-8000-000000000009', 'project', 'x')$q$);
SELECT smoke.rows('edit another portfolio item', $q$UPDATE portfolio_items SET title = 'pwned'$q$, 0);
SELECT smoke.rows('delete another portfolio item', $q$DELETE FROM portfolio_items$q$, 0);
SELECT smoke.rows('own portfolio item insert', $q$INSERT INTO portfolio_items (id, portfolio_id, type, title)
  VALUES ('20000000-0000-4000-8000-00000000000c', '20000000-0000-4000-8000-00000000000a', 'project', 'B item')$q$, 1);
SELECT smoke.rows('own portfolio item update', $q$UPDATE portfolio_items SET is_visible = false WHERE id = '20000000-0000-4000-8000-00000000000c'$q$, 1);
SELECT smoke.denied('move own item into another portfolio', $q$UPDATE portfolio_items
  SET portfolio_id = '20000000-0000-4000-8000-000000000009' WHERE id = '20000000-0000-4000-8000-00000000000c'$q$);
SELECT smoke.rows('own portfolio item delete', $q$DELETE FROM portfolio_items WHERE id = '20000000-0000-4000-8000-00000000000c'$q$, 1);
SELECT smoke.denied('non-team kanban card insert', $q$INSERT INTO kanban_cards (column_id, title, position)
  VALUES ('10000000-0000-4000-8000-000000000003', 'x', 1)$q$);
SELECT smoke.rows('non-team kanban card update', $q$UPDATE kanban_cards SET title = 'pwned'$q$, 0);
SELECT smoke.rows('non-team kanban column delete', $q$DELETE FROM kanban_columns$q$, 0);
SELECT smoke.rows('non-team kanban label delete', $q$DELETE FROM kanban_card_labels$q$, 0);
SELECT smoke.rows('non-team kanban checklist tick', $q$UPDATE kanban_card_checklist SET is_completed = true$q$, 0);
SELECT smoke.denied('non-team kanban assign', $q$INSERT INTO kanban_card_assignees (card_id, user_id)
  VALUES ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000b')$q$);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM announcements) = 1 AND (SELECT count(*) FROM events) = 1
     AND (SELECT count(*) FROM quests) = 1 AND (SELECT count(*) FROM kanban_cards) = 1,
    'FAIL: T4 lost read access';
  RAISE NOTICE 'ok: T4 still reads announcements/events/quests/kanban';
END $$;
COMMIT;

-- ─── a: T4 on team X (owner / participant paths the UI uses) ────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
SELECT smoke.rows('team member adds card', $q$INSERT INTO kanban_cards (id, column_id, title, position)
  VALUES ('10000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'new', 1)$q$, 1);
SELECT smoke.rows('team member moves cards', $q$UPDATE kanban_cards SET position = position + 1$q$, 2);
SELECT smoke.rows('team member labels card', $q$INSERT INTO kanban_card_labels (card_id, label)
  VALUES ('10000000-0000-4000-8000-000000000007', 'x')$q$, 1);
SELECT smoke.rows('team member ticks checklist', $q$UPDATE kanban_card_checklist SET is_completed = true$q$, 1);
SELECT smoke.rows('team member assigns self', $q$INSERT INTO kanban_card_assignees (card_id, user_id)
  VALUES ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-00000000000a')$q$, 1);
SELECT smoke.rows('team member deletes card', $q$DELETE FROM kanban_cards WHERE id = '10000000-0000-4000-8000-000000000007'$q$, 1);
SELECT smoke.rows('mentor accepts request', $q$UPDATE mentorship_matches SET status = 'active'
  WHERE id = '20000000-0000-4000-8000-000000000008'$q$, 1);
SELECT smoke.rows('owner edits own portfolio item', $q$UPDATE portfolio_items SET title = 'A2'$q$, 1);
SELECT smoke.rows('poster edits own job (T1/T2 moderate only)', $q$UPDATE job_listings SET title = 'x'$q$, 0);
COMMIT;

-- ─── d: T3 staff (routes + admin pages allow T1-T3) ─────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}';
SELECT smoke.rows('T3 insert announcement', $q$INSERT INTO announcements (title, body, created_by)
  VALUES ('Staff', 'x', '00000000-0000-4000-8000-00000000000d')$q$, 1);
SELECT smoke.rows('T3 pin announcements', $q$UPDATE announcements SET is_pinned = true$q$, 2);
SELECT smoke.rows('T3 delete announcement', $q$DELETE FROM announcements WHERE title = 'Staff'$q$, 1);
SELECT smoke.rows('T3 insert event', $q$INSERT INTO events (title, event_type, start_time, status, created_by, approved_by)
  VALUES ('Workshop', 'workshop', now(), 'approved', '00000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-00000000000d')$q$, 1);
SELECT smoke.rows('T3 edit events', $q$UPDATE events SET location = 'UCC'$q$, 2);
SELECT smoke.rows('T3 insert quest', $q$INSERT INTO quests (title, description, quest_type) VALUES ('Q2', 'x', 'weekly')$q$, 1);
SELECT smoke.rows('T3 toggle quests', $q$UPDATE quests SET is_active = false$q$, 2);
SELECT smoke.rows('T3 delete quest', $q$DELETE FROM quests WHERE title = 'Q2'$q$, 1);
SELECT smoke.rows('T3 insert shop item', $q$INSERT INTO marketplace_items (name, price_tc) VALUES ('Sticker', 50)$q$, 1);
SELECT smoke.rows('T3 delete shop item', $q$DELETE FROM marketplace_items WHERE name = 'Sticker'$q$, 1);
SELECT smoke.rows('T3 fulfil order', $q$UPDATE marketplace_orders SET status = 'fulfilled', fulfilled_at = now()$q$, 1);
SELECT smoke.rows('T3 insert open bounty', $q$INSERT INTO bounties (title, description, status, submitted_by, approved_by)
  VALUES ('Staff', 'x', 'open', '00000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-00000000000d')$q$, 1);
SELECT smoke.rows('T3 approve bounties', $q$UPDATE bounties SET status = 'open' WHERE status = 'pending'$q$, 1);
SELECT smoke.rows('T3 cannot moderate jobs (T1/T2)', $q$DELETE FROM job_listings$q$, 0);
SELECT smoke.denied('T3 non-team kanban insert', $q$INSERT INTO kanban_cards (column_id, title, position)
  VALUES ('10000000-0000-4000-8000-000000000003', 'x', 1)$q$);
SELECT smoke.denied('T3 insert TC ledger row', $q$INSERT INTO tc_transactions (user_id, amount, balance_after, type)
  VALUES ('00000000-0000-4000-8000-00000000000d', 5, 5, 'earn_admin')$q$);
COMMIT;

-- ─── c: T1 ───────────────────────────────────────────────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}';
SELECT smoke.rows('T1 flags job', $q$UPDATE job_listings SET is_flagged = true WHERE posted_by = '00000000-0000-4000-8000-00000000000b'$q$, 1);
SELECT smoke.rows('T1 removes job', $q$DELETE FROM job_listings WHERE posted_by = '00000000-0000-4000-8000-00000000000b'$q$, 1);
SELECT smoke.rows('T1 edits any kanban board', $q$UPDATE kanban_cards SET priority = 'high'$q$, 1);
SELECT smoke.denied('T1 insert XP ledger row', $q$INSERT INTO xp_transactions (user_id, amount, type)
  VALUES ('00000000-0000-4000-8000-00000000000c', 5, 'event')$q$);
COMMIT;

-- ─── anon ────────────────────────────────────────────────────────────────────
BEGIN;
SET LOCAL ROLE anon;
SELECT smoke.denied('anon insert announcement', $q$INSERT INTO announcements (title, body) VALUES ('x', 'x')$q$);
SELECT smoke.denied('anon insert bounty', $q$INSERT INTO bounties (title, description) VALUES ('x', 'x')$q$);
SELECT smoke.rows('anon update quests', $q$UPDATE quests SET tc_reward = 1$q$, 0);
COMMIT;

-- ─── service_role (server routes) ────────────────────────────────────────────
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
SELECT smoke.rows('service_role TC ledger', $q$INSERT INTO tc_transactions (user_id, amount, balance_after, type)
  VALUES ('00000000-0000-4000-8000-00000000000a', -500, 0, 'spend_marketplace')$q$, 1);
SELECT smoke.rows('service_role XP ledger', $q$INSERT INTO xp_transactions (user_id, amount, type)
  VALUES ('00000000-0000-4000-8000-00000000000a', 10, 'event')$q$, 1);
SELECT smoke.rows('service_role notification', $q$INSERT INTO notifications (user_id, type, title)
  VALUES ('00000000-0000-4000-8000-00000000000a', 'bounty', 'Approved')$q$, 1);
SELECT smoke.rows('service_role order', $q$INSERT INTO marketplace_orders (user_id, item_id, total_tc)
  VALUES ('00000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-000000000004', 500)$q$, 1);
SELECT smoke.rows('service_role stock decrement', $q$UPDATE marketplace_items SET stock = stock - 1$q$, 1);
SELECT smoke.rows('service_role bounty claimed', $q$UPDATE bounties SET status = 'claimed'
  WHERE id = '20000000-0000-4000-8000-000000000006'$q$, 1);
COMMIT;

-- Owner can still mark their own notification read; nothing T4 tried stuck.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
SELECT smoke.rows('owner marks notification read', $q$UPDATE notifications SET is_read = true$q$, 1);
COMMIT;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM tc_transactions WHERE user_id = '00000000-0000-4000-8000-00000000000b') = 0, 'FAIL: b ledger';
  ASSERT (SELECT price_tc FROM marketplace_items WHERE id = '20000000-0000-4000-8000-000000000004') = 500, 'FAIL: price';
  ASSERT (SELECT title FROM portfolio_items WHERE id = '20000000-0000-4000-8000-00000000000b') = 'A2', 'FAIL: a item';
  ASSERT (SELECT count(*) FROM bounties WHERE pay_tc = 99999) = 0, 'FAIL: bounty pay';
  RAISE NOTICE 'ok: final state (no T4 writes stuck; owner/staff/service writes did)';
END $$;
DROP SCHEMA smoke CASCADE;
