-- A saved GENESIS pass (specs/genesis-pass.md): one pass per account, so signing in on any phone finds it.
create unique index if not exists genesis_passes_user_id_key on public.genesis_passes (user_id) where user_id is not null;
