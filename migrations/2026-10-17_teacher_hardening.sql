-- تقوية صلاحيات المعلم + شاشات "تقييمي" و"علاواتي"
-- لم يُطبَّق بعد على قاعدة البيانات: شغّله من Supabase SQL Editor (مشروع masar-centers) أو اطلب من Claude تطبيقه.

-- 1) evaluations: المعلم يقرأ/يضيف لطلاب مجموعاته، لكن يعدّل/يحذف تقييماته هو بس
drop policy if exists "teacher manages evaluations for own classrooms children" on public.evaluations;

create policy "teacher reads evaluations for own classrooms children" on public.evaluations
for select using (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and exists (select 1 from children c, teachers t
      where c.id = evaluations.child_id and t.id = current_person_id() and c.classroom_ids && t.classroom_ids)
  )
);
create policy "teacher inserts own evaluations" on public.evaluations
for insert with check (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and payload->>'teacherId' = current_person_id()
    and exists (select 1 from children c, teachers t
      where c.id = evaluations.child_id and t.id = current_person_id() and c.classroom_ids && t.classroom_ids)
  )
);
create policy "teacher updates own evaluations" on public.evaluations
for update using (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and payload->>'teacherId' = current_person_id()
  )
) with check (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and payload->>'teacherId' = current_person_id()
  )
);
create policy "teacher deletes own evaluations" on public.evaluations
for delete using (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and payload->>'teacherId' = current_person_id()
  )
);

-- 2) events: نفس الفكرة (الأحداث القديمة بدون teacherId تفضل متاحة لمعلمي المجموعة)
drop policy if exists "teacher manages events for own classrooms" on public.events;

create policy "teacher reads events for own classrooms" on public.events
for select using (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and exists (select 1 from teachers t where t.id = current_person_id() and events.classroom_id = any(t.classroom_ids))
  )
);
create policy "teacher inserts events for own classrooms" on public.events
for insert with check (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and exists (select 1 from teachers t where t.id = current_person_id() and events.classroom_id = any(t.classroom_ids))
  )
);
create policy "teacher updates own events" on public.events
for update using (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and (payload->>'teacherId' is null or payload->>'teacherId' = current_person_id())
    and exists (select 1 from teachers t where t.id = current_person_id() and events.classroom_id = any(t.classroom_ids))
  )
) with check (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and exists (select 1 from teachers t where t.id = current_person_id() and events.classroom_id = any(t.classroom_ids))
  )
);
create policy "teacher deletes own events" on public.events
for delete using (
  is_super_admin() or (
    "current_role"() = 'TEACHER' and center_id = current_center_id()
    and (payload->>'teacherId' is null or payload->>'teacherId' = current_person_id())
    and exists (select 1 from teachers t where t.id = current_person_id() and events.classroom_id = any(t.classroom_ids))
  )
);

-- 3) وقت حضور/انصراف المعلم يتختم من السيرفر (مع احترام الوقت المحاكى للسنتر)
create or replace function public.stamp_teacher_attendance_time()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_off bigint;
begin
  select coalesce(simulated_time_offset_ms, 0) into v_off from centers where id = new.center_id;
  new.payload := jsonb_set(
    coalesce(new.payload, '{}'::jsonb), '{time}',
    to_jsonb(to_char((now() + make_interval(secs => coalesce(v_off,0)/1000.0)) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  );
  return new;
end $$;
revoke execute on function public.stamp_teacher_attendance_time() from public, anon, authenticated;

drop trigger if exists trg_stamp_teacher_attendance_time on public.teacher_attendance;
create trigger trg_stamp_teacher_attendance_time
before insert on public.teacher_attendance
for each row execute function public.stamp_teacher_attendance_time();

-- 4) المعلم يقرأ تقييماته وعلاواته هو بس
create policy "teacher reads own teacher_evaluations" on public.teacher_evaluations
for select using (
  "current_role"() = 'TEACHER' and center_id = current_center_id() and teacher_id = current_person_id()
);
create policy "teacher reads own teacher_raises" on public.teacher_raises
for select using (
  "current_role"() = 'TEACHER' and center_id = current_center_id() and teacher_id = current_person_id()
);

-- 5) إعدادات حساب تقييم المدرّسين (بيحفظها المدير من ⚙️ الإعدادات) — عمود JSON واحد، بدون أي حذف
alter table public.app_settings add column if not exists teacher_eval_config jsonb;
