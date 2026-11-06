-- لوحة المطور: نظرة عامة على النظام (قراءة فقط). مالك المنصة وفريقه (is_super_admin).
create or replace function public.dev_system_overview()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
declare r jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_super_admin,false)) then
    raise exception 'forbidden';
  end if;
  select jsonb_build_object(
    'db_size', pg_size_pretty(pg_database_size(current_database())),
    'db_bytes', pg_database_size(current_database()),
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', c.relname, 'rls', c.relrowsecurity,
               'rows', coalesce(s.n_live_tup, 0),
               'policies', (select count(*) from pg_policy p where p.polrelid = c.oid)) order by c.relname), '[]'::jsonb)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_stat_user_tables s on s.relid = c.oid
      where n.nspname = 'public' and c.relkind = 'r'),
    'centers', (
      select coalesce(jsonb_object_agg(st, cnt), '{}'::jsonb)
      from (select coalesce(subscription_status, '—') as st, count(*) as cnt
            from public.centers where deleted_at is null group by 1) x),
    'users', (
      select coalesce(jsonb_object_agg(rl, cnt), '{}'::jsonb)
      from (select coalesce(role, 'OWNER') as rl, count(*) as cnt from public.profiles group by 1) y)
  ) into r;
  return r;
end $$;
revoke all on function public.dev_system_overview() from public, anon;
grant execute on function public.dev_system_overview() to authenticated;
