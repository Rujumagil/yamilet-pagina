create table if not exists public.academy_event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.academy_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'expected' check (status in ('expected','confirmed','attended','absent','excused')),
  notes text null,
  marked_by uuid null references auth.users(id) on delete set null,
  marked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,user_id)
);

create index if not exists academy_event_attendance_event_status_idx on public.academy_event_attendance(event_id,status);
create index if not exists academy_event_attendance_user_idx on public.academy_event_attendance(user_id);

alter table public.academy_event_attendance enable row level security;
revoke all on table public.academy_event_attendance from anon, authenticated;

drop trigger if exists academy_event_attendance_set_updated_at on public.academy_event_attendance;
create trigger academy_event_attendance_set_updated_at before update on public.academy_event_attendance for each row execute function public.set_updated_at();

create or replace function private.admin_academy_event_roster_impl(target_event uuid)
returns table(
  user_id uuid,
  student_name text,
  student_email text,
  enrollment_status text,
  attendance_status text,
  attendance_notes text,
  marked_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid := auth.uid();
  ev public.academy_events%rowtype;
begin
  if uid is null then raise exception 'Autenticación requerida'; end if;
  select * into ev from public.academy_events where id=target_event;
  if not found then raise exception 'Evento no encontrado'; end if;
  if not (
    private.current_user_has_workspace_role(ev.workspace_id,array['owner','admin','instructor'])
    or private.current_user_is_platform_admin()
  ) then raise exception 'No autorizado para consultar asistentes'; end if;

  return query
  with audience as (
    select distinct on (e.user_id)
      e.user_id,
      e.status as enrollment_status,
      e.enrolled_at
    from public.enrollments e
    join public.courses c on c.id=e.course_id
    where c.workspace_id=ev.workspace_id
      and e.status in ('active','completed')
      and (ev.course_id is null or e.course_id=ev.course_id)
    order by e.user_id,
      case when e.status='active' then 0 else 1 end,
      e.enrolled_at desc
  )
  select
    a.user_id,
    coalesce(nullif(trim(p.full_name),''),nullif(trim(p.email),''),'Estudiante') as student_name,
    p.email as student_email,
    a.enrollment_status,
    coalesce(att.status,'expected') as attendance_status,
    att.notes as attendance_notes,
    att.marked_at
  from audience a
  left join public.profiles p on p.id=a.user_id
  left join public.academy_event_attendance att on att.event_id=ev.id and att.user_id=a.user_id
  order by lower(coalesce(nullif(trim(p.full_name),''),p.email,'Estudiante'));
end
$$;

create or replace function private.admin_set_academy_event_attendance_impl(
  target_event uuid,
  target_user uuid,
  target_status text,
  target_notes text default null
)
returns table(attendance_status text,attendance_notes text,marked_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid := auth.uid();
  ev public.academy_events%rowtype;
  clean_status text := lower(trim(coalesce(target_status,'')));
  clean_notes text := nullif(trim(coalesce(target_notes,'')),'');
  row_item public.academy_event_attendance%rowtype;
begin
  if uid is null then raise exception 'Autenticación requerida'; end if;
  select * into ev from public.academy_events where id=target_event;
  if not found then raise exception 'Evento no encontrado'; end if;
  if not (
    private.current_user_has_workspace_role(ev.workspace_id,array['owner','admin','instructor'])
    or private.current_user_is_platform_admin()
  ) then raise exception 'No autorizado para registrar asistencia'; end if;
  if clean_status not in ('expected','confirmed','attended','absent','excused') then
    raise exception 'Estado de asistencia no válido';
  end if;
  if not exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id=e.course_id
    where e.user_id=target_user
      and c.workspace_id=ev.workspace_id
      and e.status in ('active','completed')
      and (ev.course_id is null or e.course_id=ev.course_id)
  ) then raise exception 'La persona no pertenece a la audiencia de este evento'; end if;

  if clean_status='expected' and clean_notes is null then
    delete from public.academy_event_attendance where event_id=target_event and user_id=target_user;
    return query select 'expected'::text,null::text,null::timestamptz;
    return;
  end if;

  insert into public.academy_event_attendance(event_id,user_id,status,notes,marked_by,marked_at,updated_at)
  values(target_event,target_user,clean_status,clean_notes,uid,now(),now())
  on conflict(event_id,user_id) do update set
    status=excluded.status,
    notes=excluded.notes,
    marked_by=excluded.marked_by,
    marked_at=excluded.marked_at,
    updated_at=now()
  returning * into row_item;

  return query select row_item.status,row_item.notes,row_item.marked_at;
end
$$;

revoke all on function private.admin_academy_event_roster_impl(uuid) from public;
revoke all on function private.admin_set_academy_event_attendance_impl(uuid,uuid,text,text) from public;
grant usage on schema private to authenticated;
grant execute on function private.admin_academy_event_roster_impl(uuid) to authenticated;
grant execute on function private.admin_set_academy_event_attendance_impl(uuid,uuid,text,text) to authenticated;

create or replace function public.admin_academy_event_roster(target_event uuid)
returns table(
  user_id uuid,
  student_name text,
  student_email text,
  enrollment_status text,
  attendance_status text,
  attendance_notes text,
  marked_at timestamptz
)
language sql
security invoker
set search_path=''
as $$ select * from private.admin_academy_event_roster_impl(target_event) $$;

create or replace function public.admin_set_academy_event_attendance(
  target_event uuid,
  target_user uuid,
  target_status text,
  target_notes text default null
)
returns table(attendance_status text,attendance_notes text,marked_at timestamptz)
language sql
security invoker
set search_path=''
as $$ select * from private.admin_set_academy_event_attendance_impl(target_event,target_user,target_status,target_notes) $$;

revoke all on function public.admin_academy_event_roster(uuid) from public;
revoke all on function public.admin_set_academy_event_attendance(uuid,uuid,text,text) from public;
grant execute on function public.admin_academy_event_roster(uuid) to authenticated;
grant execute on function public.admin_set_academy_event_attendance(uuid,uuid,text,text) to authenticated;