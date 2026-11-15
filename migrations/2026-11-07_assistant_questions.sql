-- سجل أسئلة المساعد اللي مااتجاوبتش أوفلاين + إحصائيات تغطية يومية. الاسم والرقم بيتشالوا على العميل قبل الإرسال.
-- الكتابة عن طريق RPC بس (بتاخد المركز والدور من الجلسة مش من العميل). القراءة والتعليم لمالك المنصة وفريقه.
create table if not exists public.assistant_questions (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid not null,
  center_id uuid not null,
  role text not null,
  q text not null,
  outcome text not null check (outcome in ('ai','fallback','none')),
  resolved boolean not null default false
);
create index if not exists assistant_questions_q_idx on public.assistant_questions (q);
create index if not exists assistant_questions_at_idx on public.assistant_questions (at desc);
alter table public.assistant_questions enable row level security;
revoke all on public.assistant_questions from anon, authenticated;

create table if not exists public.assistant_daily_stats (
  day date not null, center_id uuid not null, role text not null,
  local_n int not null default 0, ai_n int not null default 0, fallback_n int not null default 0, none_n int not null default 0,
  primary key (day, center_id, role)
);
alter table public.assistant_daily_stats enable row level security;
revoke all on public.assistant_daily_stats from anon, authenticated;

create or replace function public.assistant_log_batch(p_items jsonb, p_stats jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_role text; v_center uuid; v_uid uuid := auth.uid(); it jsonb; v_q text; v_o text; v_today int; n int := 0;
begin
  if v_uid is null then return; end if;
  select p.role, p.center_id into v_role, v_center from public.profiles p where p.id = v_uid;
  if v_center is null or v_role not in ('ADMIN','TEACHER','PARENT','ASSISTANT') then return; end if;
  select count(*) into v_today from public.assistant_questions where user_id = v_uid and at > now() - interval '1 day';
  if jsonb_typeof(p_items) = 'array' then
    for it in select * from jsonb_array_elements(p_items) loop
      exit when n >= 30 or v_today + n >= 100;
      v_q := left(btrim(coalesce(it->>'q','')), 160); v_o := it->>'outcome';
      continue when length(v_q) < 3 or v_o not in ('ai','fallback','none');
      insert into public.assistant_questions(user_id, center_id, role, q, outcome) values (v_uid, v_center, v_role, v_q, v_o);
      n := n + 1;
    end loop;
  end if;
  if jsonb_typeof(p_stats) = 'object' then
    insert into public.assistant_daily_stats(day, center_id, role, local_n, ai_n, fallback_n, none_n)
    values (current_date, v_center, v_role,
      greatest(0, least(coalesce((p_stats->>'local')::int,0), 1000)), greatest(0, least(coalesce((p_stats->>'ai')::int,0), 1000)),
      greatest(0, least(coalesce((p_stats->>'fallback')::int,0), 1000)), greatest(0, least(coalesce((p_stats->>'none')::int,0), 1000)))
    on conflict (day, center_id, role) do update set
      local_n = public.assistant_daily_stats.local_n + excluded.local_n, ai_n = public.assistant_daily_stats.ai_n + excluded.ai_n,
      fallback_n = public.assistant_daily_stats.fallback_n + excluded.fallback_n, none_n = public.assistant_daily_stats.none_n + excluded.none_n;
  end if;
  if random() < 0.02 then delete from public.assistant_questions where at < now() - interval '90 days'; end if;
end $$;

create or replace function public.assistant_questions_overview(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb; d int := greatest(1, least(coalesce(p_days,30), 365));
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_super_admin,false)) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'stats', (select jsonb_build_object('local', coalesce(sum(local_n),0), 'ai', coalesce(sum(ai_n),0), 'fallback', coalesce(sum(fallback_n),0), 'none', coalesce(sum(none_n),0))
              from public.assistant_daily_stats where day >= current_date - d),
    'questions', (select coalesce(jsonb_agg(x order by (x->>'cnt')::int desc, x->>'last_seen' desc), '[]'::jsonb) from (
        select jsonb_build_object('q', q, 'cnt', count(*), 'last_seen', max(at), 'centers', count(distinct center_id),
                 'roles', (select jsonb_agg(distinct r2) from unnest(array_agg(role)) r2),
                 'none', count(*) filter (where outcome='none'), 'fallback', count(*) filter (where outcome='fallback'), 'ai', count(*) filter (where outcome='ai'),
                 'resolved', bool_and(resolved)) as x
        from public.assistant_questions where at >= now() - make_interval(days => d)
        group by q order by count(*) desc, max(at) desc limit 150) s)
  ) into r;
  return r;
end $$;

create or replace function public.assistant_question_mark(p_q text, p_resolved boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_super_admin,false)) then raise exception 'forbidden'; end if;
  update public.assistant_questions set resolved = coalesce(p_resolved,false) where q = p_q;
end $$;

revoke all on function public.assistant_log_batch(jsonb,jsonb), public.assistant_questions_overview(int), public.assistant_question_mark(text,boolean) from public, anon;
grant execute on function public.assistant_log_batch(jsonb,jsonb), public.assistant_questions_overview(int), public.assistant_question_mark(text,boolean) to authenticated;
