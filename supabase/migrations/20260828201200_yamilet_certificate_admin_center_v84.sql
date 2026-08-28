create or replace function private.try_auto_issue_academy_certificate(target_user uuid,target_course uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  elig record;
  cid uuid;
begin
  if target_user is null or target_course is null then return false; end if;
  if not exists(
    select 1 from public.enrollments e
    where e.user_id=target_user and e.course_id=target_course and e.status in ('active','completed')
  ) then return false; end if;
  select * into elig from private.certificate_eligibility_for_user(target_user,target_course);
  if not coalesce(elig.eligible,false) then return false; end if;
  if exists(
    select 1 from public.certificates c
    where c.user_id=target_user and c.course_id=target_course
  ) then return false; end if;
  select certificate_id into cid
  from private.issue_academy_certificate_for_user(target_user,target_course)
  limit 1;
  return cid is not null;
exception when others then
  return false;
end;
$$;

create or replace function private.auto_certificate_from_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  target_course uuid;
begin
  if new.completed=true and (tg_op='INSERT' or old.completed is distinct from new.completed) then
    select m.course_id into target_course
    from public.lessons l
    join public.modules m on m.id=l.module_id
    where l.id=new.lesson_id;
    if target_course is not null then
      perform private.try_auto_issue_academy_certificate(new.user_id,target_course);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_certificate_from_lesson_progress on public.lesson_progress;
create trigger auto_certificate_from_lesson_progress
after insert or update of completed on public.lesson_progress
for each row execute function private.auto_certificate_from_lesson_progress();

create or replace function private.admin_academy_certificate_roster_impl(target_workspace uuid)
returns table(
  user_id uuid,
  course_id uuid,
  student_name text,
  student_email text,
  enrollment_status text,
  total_lessons integer,
  completed_lessons integer,
  required_assessments integer,
  passed_assessments integer,
  eligible boolean,
  certificate_id uuid,
  verification_code text,
  recipient_name text,
  issued_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid:=auth.uid();
  allowed boolean:=false;
begin
  if uid is null then raise exception 'Autenticación requerida'; end if;
  allowed:=exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id=target_workspace and wm.user_id=uid and wm.status='active'
      and wm.role in ('owner','admin','instructor')
  ) or exists(select 1 from public.profiles p where p.id=uid and p.role='admin');
  if not allowed then raise exception 'No autorizado para consultar certificación'; end if;

  return query
  select
    e.user_id,
    e.course_id,
    coalesce(nullif(trim(p.full_name),''),nullif(trim(p.email),''),'Estudiante') as student_name,
    p.email as student_email,
    e.status as enrollment_status,
    elig.total_lessons,
    elig.completed_lessons,
    elig.required_assessments,
    elig.passed_assessments,
    elig.eligible,
    cert.id as certificate_id,
    cert.verification_code,
    cert.recipient_name,
    cert.issued_at,
    cert.revoked_at,
    cert.revoked_reason
  from public.enrollments e
  join public.courses cr on cr.id=e.course_id and cr.workspace_id=target_workspace
  left join public.profiles p on p.id=e.user_id
  cross join lateral private.certificate_eligibility_for_user(e.user_id,e.course_id) elig
  left join lateral (
    select c.id,c.verification_code,c.recipient_name,c.issued_at,c.revoked_at,c.revoked_reason
    from public.certificates c
    where c.user_id=e.user_id and c.course_id=e.course_id
    order by c.issued_at desc
    limit 1
  ) cert on true
  order by coalesce(nullif(trim(p.full_name),''),p.email,'Estudiante'),cr.title;
end;
$$;

revoke all on function private.admin_academy_certificate_roster_impl(uuid) from public;
grant execute on function private.admin_academy_certificate_roster_impl(uuid) to authenticated;

create or replace function public.admin_academy_certificate_roster(target_workspace uuid)
returns table(
  user_id uuid,
  course_id uuid,
  student_name text,
  student_email text,
  enrollment_status text,
  total_lessons integer,
  completed_lessons integer,
  required_assessments integer,
  passed_assessments integer,
  eligible boolean,
  certificate_id uuid,
  verification_code text,
  recipient_name text,
  issued_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
)
language sql
security invoker
set search_path to ''
as $$
  select * from private.admin_academy_certificate_roster_impl(target_workspace)
$$;
revoke all on function public.admin_academy_certificate_roster(uuid) from public;
grant execute on function public.admin_academy_certificate_roster(uuid) to authenticated;

create or replace function private.admin_issue_academy_certificate_impl(target_user uuid,target_course uuid)
returns table(certificate_id uuid,verification_code text,recipient_name text,course_title text,issued_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid:=auth.uid();
  ws uuid;
  allowed boolean:=false;
begin
  if uid is null then raise exception 'Autenticación requerida'; end if;
  select c.workspace_id into ws from public.courses c where c.id=target_course;
  if ws is null then raise exception 'Curso no encontrado'; end if;
  allowed:=exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id=ws and wm.user_id=uid and wm.status='active' and wm.role in ('owner','admin')
  ) or exists(select 1 from public.profiles p where p.id=uid and p.role='admin');
  if not allowed then raise exception 'No autorizado para emitir certificados'; end if;
  if exists(
    select 1 from public.certificates c
    where c.user_id=target_user and c.course_id=target_course and c.revoked_at is not null
  ) and not exists(
    select 1 from public.certificates c
    where c.user_id=target_user and c.course_id=target_course and c.revoked_at is null
  ) then
    raise exception 'Existe un certificado revocado. Restáuralo en lugar de emitir uno nuevo';
  end if;
  return query select * from private.issue_academy_certificate_for_user(target_user,target_course);
end;
$$;

revoke all on function private.admin_issue_academy_certificate_impl(uuid,uuid) from public;
grant execute on function private.admin_issue_academy_certificate_impl(uuid,uuid) to authenticated;

create or replace function public.admin_issue_academy_certificate(target_user uuid,target_course uuid)
returns table(certificate_id uuid,verification_code text,recipient_name text,course_title text,issued_at timestamptz)
language sql
security invoker
set search_path to ''
as $$
  select * from private.admin_issue_academy_certificate_impl(target_user,target_course)
$$;
revoke all on function public.admin_issue_academy_certificate(uuid,uuid) from public;
grant execute on function public.admin_issue_academy_certificate(uuid,uuid) to authenticated;