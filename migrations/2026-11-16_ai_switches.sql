-- مفاتيح تشغيل المساعد الذكي (للمالك): تشغيل/إيقاف كل طريقة ربط بالشات من لوحة المالك.
-- القراءة: أي مستخدم مسجّل (عشان المساعد يعرف إيه المفعّل). التعديل: المالك الأساسي بس.
-- لو الجدول أو الدالة مش موجودين، التطبيق بيشتغل بالافتراضي (كله مفعّل) من غير ما يقع.

create table if not exists public.ai_switches (
  key text primary key check (key in ('local_engine','on_device','api','suggestions')),
  enabled boolean not null default true,
  value text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.ai_switches enable row level security;
revoke all on public.ai_switches from anon, authenticated;

insert into public.ai_switches(key, enabled, value) values
  ('local_engine', true, null),
  ('on_device',    true, 'ADMIN'),   -- الأدوار المسموح لها: ADMIN (مدير بس، مرحلة التجربة) أو ALL
  ('api',          true, null),
  ('suggestions',  true, null)
on conflict (key) do nothing;

create or replace function public.ai_switches_get()
returns table(key text, enabled boolean, value text)
language sql stable security definer set search_path to 'public'
as $$ select s.key, s.enabled, s.value from public.ai_switches s where auth.uid() is not null $$;

create or replace function public.ai_switch_set(p_key text, p_enabled boolean, p_value text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_super_admin,false) and coalesce(p.is_owner,false)) then
    raise exception 'forbidden';
  end if;
  if p_key not in ('local_engine','on_device','api','suggestions') then raise exception 'invalid key'; end if;
  if p_key = 'on_device' and p_value is not null and p_value not in ('ADMIN','ALL') then raise exception 'invalid value'; end if;
  update public.ai_switches
     set enabled = coalesce(p_enabled, enabled), value = coalesce(p_value, value), updated_at = now(), updated_by = auth.uid()
   where key = p_key;
  if not found then raise exception 'not found'; end if;
  insert into public.ai_key_audit(actor, action, detail)
  values (auth.uid(), 'switch', p_key || ' enabled=' || coalesce(p_enabled::text,'-') || coalesce(' value='||p_value,''));
end $$;

revoke all on function public.ai_switches_get(), public.ai_switch_set(text,boolean,text) from public, anon;
grant execute on function public.ai_switches_get(), public.ai_switch_set(text,boolean,text) to authenticated;
