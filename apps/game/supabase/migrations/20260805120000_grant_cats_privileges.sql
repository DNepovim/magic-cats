-- RLS policies alone do not grant table privileges: a role still needs a GRANT
-- before its policies are ever evaluated. Without this, every query from the
-- app fails with 42501 "permission denied for table cats".
--
-- Only `authenticated` is granted: all reads/writes in +page.server.ts and
-- /api/cats happen behind a `locals.user` check, and the RLS policies in
-- 20260101000000_create_cats.sql are all `to authenticated`. `anon` is
-- deliberately left with no access.

grant select, insert, update, delete on public.cats to authenticated;
grant all on public.cats to service_role;
