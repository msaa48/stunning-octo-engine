-- لوحة المطور: رؤية كل مفاتيح الـAI (منصة + مراكز) بشكل مقنّع + تعديلها + سجل تدقيق.
-- المبدأ: السر الكامل مايرجعش للمتصفح أبدًا. بيرجع بس آخر 4 حروف + الطول، والتعديل = استبدال.
-- كل الدوال: المالك فقط (profiles.is_super_admin) — SECURITY DEFINER.

create table if not exists public.ai_key_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  key_id uuid,
  center_id uuid,
  action text not null,
  detail text
);
alter table public.ai_key_audit enable row level security;
revoke all on public.ai_key_audit from anon, authenticated;

create or replace function public.ai_keys_overview()
returns table(
  id uuid, center_id uuid, center_name text, scope text, provider text, model text,
  priority int, enabled boolean, vision boolean, label text, created_at timestamptz,
  last_status text, last_checked_at timestamptz, key_tail text, key_len int,
  calls_today int, platform_calls_today int
)
language plpgsql stable security definer
set search_path to 'public','vault'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_super_admin,false)) then
    raise exception 'forbidden';
  end if;
  return query
  select k.id, k.center_id, c.name, case when k.center_id is null then 'platform' else 'center' end,
         k.provider, k.model, k.priority, k.enabled, k.vision, k.label, k.created_at,
         k.last_status, k.last_checked_at,
         case when d.decrypted_secret is null then null else right(d.decrypted_secret, 4) end,
         case when d.decrypted_secret is null then null else length(d.decrypted_secret) end,
         coalesce(u.calls,0), coalesce(u.platform_calls,0)
  from public.ai_provider_keys k
  left join public.centers c on c.id = k.center_id
  left join vault.decrypted_secrets d on d.id = k.secret_id
  left join public.ai_usage u on u.center_id = k.center_id and u.day = current_date
  order by (k.center_id is not null), c.name nulls first, k.priority, k.created_at;
end $$;

-- المراكز اللي مفيهاش أي مفتاح + استهلاك حد المنصة اليوم (للمتابعة السريعة)
create or replace function public.ai_centers_ai_status()
returns table(center_id uuid, center_name text, subscription_status text, own_keys int, own_keys_enabled int,
              calls_today int, platform_calls_today int)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_super_admin,false)) then
    raise exception 'forbidden';
  end if;
  return query
  select c.id, c.name, c.subscription_status,
         (select count(*)::int from public.ai_provider_keys k where k.center_id = c.id),
         (select count(*)::int from public.ai_provider_keys k where k.center_id = c.id and k.enabled),
         coalesce(u.calls,0), coalesce(u.platform_calls,0)
  from public.centers c
  left join public.ai_usage u on u.center_id = c.id and u.day = current_date
  where c.deleted_at is null
  order by c.name;
end $$;

-- تعديل أي مفتاح (منصة أو مركز). كل الحقول اختيارية؛ p_key = استبدال السر.
create or replace function public.ai_update_key(
  p_id uuid, p_model text default null, p_priority int default null,
  p_enabled boolean default null, p_label text default null, p_key text default null)
returns void
language plpgsql security definer
set search_path to 'public','vault'
as $$
declare v_secret uuid; v_center uuid; v_what text := '';
begin
  -- التعديل (خصوصًا استبدال السر) للمالك الأساسي فقط، مش لفريق المنصة
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_super_admin,false) and coalesce(p.is_owner,false)) then
    raise exception 'forbidden';
  end if;
  select secret_id, center_id into v_secret, v_center from public.ai_provider_keys where id = p_id;
  if not found then raise exception 'not found'; end if;
  if p_model is not null and (length(trim(p_model)) = 0 or length(p_model) > 120) then raise exception 'invalid model'; end if;
  if p_key is not null and (length(trim(p_key)) < 20 or length(p_key) > 400) then raise exception 'invalid key'; end if;
  if p_key is not null then
    perform vault.update_secret(v_secret, trim(p_key));
    update public.ai_provider_keys set last_status = null, last_checked_at = null where id = p_id;
    v_what := v_what || 'key ';
  end if;
  if p_model is not null    then update public.ai_provider_keys set model = trim(p_model) where id = p_id; v_what := v_what || 'model '; end if;
  if p_priority is not null then update public.ai_provider_keys set priority = greatest(1, least(p_priority, 1000)) where id = p_id; v_what := v_what || 'priority '; end if;
  if p_enabled is not null  then update public.ai_provider_keys set enabled = p_enabled where id = p_id; v_what := v_what || 'enabled=' || p_enabled || ' '; end if;
  if p_label is not null    then update public.ai_provider_keys set label = nullif(left(trim(p_label),60),'') where id = p_id; v_what := v_what || 'label '; end if;
  insert into public.ai_key_audit(actor, key_id, center_id, action, detail) values (auth.uid(), p_id, v_center, 'update', trim(v_what));
end $$;

create or replace function public.ai_key_audit_list(p_limit int default 30)
returns table(at timestamptz, actor_email text, center_name text, action text, detail text)
language plpgsql stable security definer
set search_path to 'public','auth'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_super_admin,false)) then
    raise exception 'forbidden';
  end if;
  return query
  select a.at, u.email::text, c.name, a.action, a.detail
  from public.ai_key_audit a
  left join auth.users u on u.id = a.actor
  left join public.centers c on c.id = a.center_id
  order by a.at desc limit greatest(1, least(coalesce(p_limit,30), 200));
end $$;

revoke all on function public.ai_keys_overview(), public.ai_centers_ai_status(),
  public.ai_update_key(uuid,text,int,boolean,text,text), public.ai_key_audit_list(int) from public, anon;
grant execute on function public.ai_keys_overview(), public.ai_centers_ai_status(),
  public.ai_update_key(uuid,text,int,boolean,text,text), public.ai_key_audit_list(int) to authenticated;
