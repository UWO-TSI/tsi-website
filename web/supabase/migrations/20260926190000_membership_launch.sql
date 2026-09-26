-- ─── Membership and tier at launch (coordinator rulings 1 and 3, 2026-09-26) ─
--
-- Follow-up to 20260926150700_identity (applied on staging, so not rewritten):
-- identity grandfathered every existing profile as a member. Ruling 1: existing
-- profiles are public unless staff (tier <= 3), hired through recruitment (a
-- released 'accepted' application) or whitelisted; T1/T2 mark anyone else
-- through POST /api/admin/members/:id/membership. Ruling 3: public accounts
-- are tier 5; members keep their tier.
-- Production at 2026-09-26 (read-only): 315 profiles -> 17 members (T1, T2,
-- 15 hired), 298 public.
-- Section 1 is a one-shot data backfill: apply this file once, at launch.
-- Re-running it demotes members T1/T2 have marked since.
-- Test: web/supabase/tests/launch_fixes_smoke.sql (sections 1-3).

-- 1 ── Existing profiles ─────────────────────────────────────────────────────
update public.profiles p
   set membership = case
         when p.tier <= 3
           or exists (select 1 from public.applications a where a.user_id = p.id and a.status = 'accepted')
           or exists (select 1 from public.member_email_whitelist w where w.email = lower(p.email))
         then 'member' else 'public' end;
update public.profiles set tier = 5 where membership = 'public' and tier = 4;

-- 2 ── Sign-ups: 155000's body, plus tier 5 for public accounts ──────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite text := upper(trim(new.raw_user_meta_data->>'invite_code'));
  v_member boolean;
begin
  begin
    v_member := exists (select 1 from public.member_email_whitelist w where w.email = lower(new.email))
      or (v_invite is not null and v_invite <> '' and exists (select 1 from public.invite_codes c where c.code = v_invite and c.is_active));
    insert into public.profiles (id, email, display_name, membership, tier)
    values (
      new.id,
      coalesce(new.email, new.raw_user_meta_data->>'email', ''),
      coalesce(
        new.raw_user_meta_data->>'display_name',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(coalesce(new.email, ''), '@', 1),
        'Agent'
      ),
      case when v_member then 'member' else 'public' end,
      case when v_member then 4 else 5 end
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'profiles insert failed for user %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- 3 ── T1/T2 mark a member or a public account ───────────────────────────────
-- Public accounts are T5; a public account marked member gets the member
-- default T4. Staff (T1-T3) can't be made public: change their tier first.
create or replace function public.admin_set_membership(p_actor_id uuid, p_member_id uuid, p_membership text)
returns table (membership text, tier integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  cur profiles%rowtype;
  v_tier integer;
begin
  if coalesce((select p.tier from profiles p where p.id = p_actor_id), 5) not in (1, 2) then raise exception 'forbidden'; end if;
  select * into cur from profiles p where p.id = p_member_id for update;
  if not found then raise exception 'not_found'; end if;
  if cur.membership = p_membership then return query select cur.membership, cur.tier; return; end if;
  if p_membership = 'public' and cur.tier <= 3 then raise exception 'staff'; end if;
  v_tier := case when p_membership = 'public' then 5 when cur.tier = 5 then 4 else cur.tier end;
  update profiles p set membership = p_membership, tier = v_tier where p.id = p_member_id;
  return query select p_membership, v_tier;
end;
$$;
revoke all on function public.admin_set_membership(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_membership(uuid, uuid, text) to service_role;
