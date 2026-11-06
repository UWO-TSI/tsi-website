-- ─── World layout: David's placements, live in production (world-editor plan b) ──────────────────────────
--
-- DRAFT 2026-11-05. NOT A MIGRATION. It lives in web/supabase/drafts/ so nothing applies it by accident. Round 1
-- saves to the repo (web/data/world/world.json, plan a); this is the staged plan for editing on play.tethos.ca,
-- written up in specs/lanes/world-editor.md ("Plan b"). If David picks it, the coordinator moves it into
-- web/supabase/migrations/ with a fresh timestamp and applies it.
--
-- One row per object David placed, moved or deleted, in world.json's own object shape (lib/game/villageMap.ts
-- MapObject: pin, `of` where the generator had put it, `gone` for a deletion). The game reads the rows after
-- world.json and lays them over its objects the way the generator's re-layout does (lib/game/world/generate.ts
-- layoutObjects), so one rule covers both. Members read; nobody writes through RLS: the editor's route checks
-- adminContext (T1/T2, lib/server/adminContext.ts) and writes with the service role. A bake script folds the rows
-- into world.json for a commit and clears them.

create table if not exists public.world_layout (
  kind text not null,
  id text not null,
  object jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (kind, id),
  constraint world_layout_object_shape check (
    jsonb_typeof(object) = 'object'
    and object ->> 'kind' = kind and object ->> 'id' = id
    and jsonb_typeof(object -> 'x') = 'number' and jsonb_typeof(object -> 'z') = 'number'
  )
);

alter table public.world_layout enable row level security;

drop policy if exists world_layout_read on public.world_layout;
create policy world_layout_read on public.world_layout for select to authenticated using (true);

-- No insert, update or delete policy: writes only through the admin route's service-role client.
revoke insert, update, delete on public.world_layout from anon, authenticated;
