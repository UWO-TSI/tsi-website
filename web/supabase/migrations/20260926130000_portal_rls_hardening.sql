-- ─── Portal tables: writes limited to the roles the app actually allows ─────
--
-- 001_initial_schema gave most portal tables write policies that only check
-- auth.role() = 'authenticated', so any signed-in user (every Google sign-in,
-- including recruitment applicants) could use the public anon key to post
-- announcements/events/quests, approve bounties, rewrite shop prices, mint
-- ledger rows, notify anyone, and edit or delete other members' rows.
-- This replaces each open write policy with the rule the routes and admin
-- pages already enforce:
--
--   tc_transactions, xp_transactions, notifications   service_role only (insert)
--   marketplace_orders insert                          service_role only (/api/economy)
--   announcements, events, quests, marketplace_items   tier <= 3 (admin area / routes)
--   marketplace_orders update                          tier <= 3 (admin fulfilment)
--   bounties insert                                    own submitted_by; tier > 3 only
--                                                      as status 'pending', unapproved
--   bounties update                                    tier <= 3
--   job_listings insert / update+delete                own posted_by / tier <= 2
--   mentorship_matches insert / update                 mentee requests 'pending' / mentor
--   portfolio_items                                    owner of the portfolio
--   kanban columns, cards, assignees, labels,          members of the board's team,
--   checklist                                          or tier <= 2
--
-- Reads are unchanged. tier and team_id are trustworthy only once
-- 20260926120000_profiles_privilege_guard (PR #40) is applied: apply that
-- first, deploy this PR's code, then apply this migration. The code changes
-- move ledger/order/stock/bounty-status writes that ordinary members trigger
-- to the service role after the route's own checks; they work with or without
-- this migration.
--
-- Rollback (SQL editor; restores the 001 behaviour):
--   create policy "TC transactions insertable" on public.tc_transactions for insert with check (auth.role() = 'authenticated');
--   create policy "XP transactions insertable" on public.xp_transactions for insert with check (auth.role() = 'authenticated');
--   create policy "Notifications insertable" on public.notifications for insert with check (auth.role() = 'authenticated');
--   create policy "Orders insertable" on public.marketplace_orders for insert with check (user_id = auth.uid());
--   alter policy "Announcements insertable by authenticated" on public.announcements with check (auth.role() = 'authenticated');
--   alter policy "Events insertable by authenticated" on public.events with check (auth.role() = 'authenticated');
--   alter policy "Bounties insertable by authenticated" on public.bounties with check (auth.role() = 'authenticated');
--   alter policy "Jobs insertable" on public.job_listings with check (auth.role() = 'authenticated');
--   alter policy "Mentorship matches insertable" on public.mentorship_matches with check (auth.role() = 'authenticated');
--   alter policy "Announcements deletable by creator" on public.announcements using (auth.role() = 'authenticated');
--   alter policy "Jobs deletable" on public.job_listings using (auth.role() = 'authenticated');
--   alter policy "Announcements updatable by creator" on public.announcements using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Events updatable by authenticated" on public.events using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Bounties updatable by authenticated" on public.bounties using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Jobs updatable" on public.job_listings using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Mentorship matches updatable" on public.mentorship_matches using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Orders updatable" on public.marketplace_orders using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Quests writable" on public.quests using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Marketplace items writable" on public.marketplace_items using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Portfolio items writable" on public.portfolio_items using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Kanban columns writable" on public.kanban_columns using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Kanban cards writable" on public.kanban_cards using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Kanban assignees writable" on public.kanban_card_assignees using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Kanban labels writable" on public.kanban_card_labels using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   alter policy "Kanban checklist writable" on public.kanban_card_checklist using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   drop function public.can_edit_kanban_board(uuid);
--   drop function public.current_tier();

-- Helpers ────────────────────────────────────────────────────────────────────
-- Caller's tier; null for anon or a user without a profile (fails every check).
create or replace function public.current_tier()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select tier from public.profiles where id = auth.uid()
$$;

create or replace function public.can_edit_kanban_board(p_board uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_tier() <= 2, false) or exists (
    select 1
    from public.kanban_boards b
    join public.profiles p on p.team_id = b.team_id
    where b.id = p_board and p.id = auth.uid()
  )
$$;

-- Ledgers, notifications, orders: server only ────────────────────────────────
drop policy "TC transactions insertable" on public.tc_transactions;
drop policy "XP transactions insertable" on public.xp_transactions;
drop policy "Notifications insertable" on public.notifications;
drop policy "Orders insertable" on public.marketplace_orders;

-- Staff content: tier <= 3 ───────────────────────────────────────────────────
alter policy "Announcements insertable by authenticated" on public.announcements
  with check (public.current_tier() <= 3);
alter policy "Announcements updatable by creator" on public.announcements
  using (public.current_tier() <= 3) with check (public.current_tier() <= 3);
alter policy "Announcements deletable by creator" on public.announcements
  using (public.current_tier() <= 3);

alter policy "Events insertable by authenticated" on public.events
  with check (public.current_tier() <= 3);
alter policy "Events updatable by authenticated" on public.events
  using (public.current_tier() <= 3) with check (public.current_tier() <= 3);

alter policy "Quests writable" on public.quests
  using (public.current_tier() <= 3) with check (public.current_tier() <= 3);

alter policy "Marketplace items writable" on public.marketplace_items
  using (public.current_tier() <= 3) with check (public.current_tier() <= 3);

alter policy "Orders updatable" on public.marketplace_orders
  using (public.current_tier() <= 3) with check (public.current_tier() <= 3);

-- Bounties: anyone may propose (pending), staff approve and edit ─────────────
alter policy "Bounties insertable by authenticated" on public.bounties
  with check (
    submitted_by = auth.uid()
    and (public.current_tier() <= 3 or (status = 'pending' and approved_by is null))
  );
alter policy "Bounties updatable by authenticated" on public.bounties
  using (public.current_tier() <= 3) with check (public.current_tier() <= 3);

-- Job board: members post as themselves, T1/T2 moderate ──────────────────────
alter policy "Jobs insertable" on public.job_listings
  with check (posted_by = auth.uid());
alter policy "Jobs updatable" on public.job_listings
  using (public.current_tier() <= 2) with check (public.current_tier() <= 2);
alter policy "Jobs deletable" on public.job_listings
  using (public.current_tier() <= 2);

-- Owner / participant rows ──────────────────────────────────────────────────
alter policy "Mentorship matches insertable" on public.mentorship_matches
  with check (mentee_id = auth.uid() and status = 'pending');
alter policy "Mentorship matches updatable" on public.mentorship_matches
  using (mentor_id = auth.uid()) with check (mentor_id = auth.uid());

alter policy "Portfolio items writable" on public.portfolio_items
  using (portfolio_id in (select id from public.portfolios where user_id = auth.uid()))
  with check (portfolio_id in (select id from public.portfolios where user_id = auth.uid()));

-- Kanban: the board's team, or T1/T2 ─────────────────────────────────────────
alter policy "Kanban columns writable" on public.kanban_columns
  using (public.can_edit_kanban_board(board_id))
  with check (public.can_edit_kanban_board(board_id));

alter policy "Kanban cards writable" on public.kanban_cards
  using (public.can_edit_kanban_board(
    (select c.board_id from public.kanban_columns c where c.id = kanban_cards.column_id)))
  with check (public.can_edit_kanban_board(
    (select c.board_id from public.kanban_columns c where c.id = kanban_cards.column_id)));

alter policy "Kanban assignees writable" on public.kanban_card_assignees
  using (public.can_edit_kanban_board(
    (select c.board_id from public.kanban_cards k join public.kanban_columns c on c.id = k.column_id
     where k.id = kanban_card_assignees.card_id)))
  with check (public.can_edit_kanban_board(
    (select c.board_id from public.kanban_cards k join public.kanban_columns c on c.id = k.column_id
     where k.id = kanban_card_assignees.card_id)));

alter policy "Kanban labels writable" on public.kanban_card_labels
  using (public.can_edit_kanban_board(
    (select c.board_id from public.kanban_cards k join public.kanban_columns c on c.id = k.column_id
     where k.id = kanban_card_labels.card_id)))
  with check (public.can_edit_kanban_board(
    (select c.board_id from public.kanban_cards k join public.kanban_columns c on c.id = k.column_id
     where k.id = kanban_card_labels.card_id)));

alter policy "Kanban checklist writable" on public.kanban_card_checklist
  using (public.can_edit_kanban_board(
    (select c.board_id from public.kanban_cards k join public.kanban_columns c on c.id = k.column_id
     where k.id = kanban_card_checklist.card_id)))
  with check (public.can_edit_kanban_board(
    (select c.board_id from public.kanban_cards k join public.kanban_columns c on c.id = k.column_id
     where k.id = kanban_card_checklist.card_id)));
