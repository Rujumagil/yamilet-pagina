-- Yamilet Academy P1.6: alumnas, invitaciones, expediente e inscripciones

create or replace function private.can_view_academy_students(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_admin()) or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and wm.role in ('owner','admin','instructor')
  );
$$;

create or replace function private.can_manage_academy_students(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_admin()) or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and wm.role in ('owner','admin')
  );
$$;

revoke all on function private.can_view_academy_students(uuid) from public;
revoke all on function private.can_manage_academy_students(uuid) from public;
grant execute on function private.can_view_academy_students(uuid) to authenticated;
grant execute on function private.can_manage_academy_students(uuid) to authenticated;

create table if not exists public.academy_student_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  email text not null,
  full_name text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','sent','linked','cancelled','error')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_student_invites_workspace_idx on public.academy_student_invites(workspace_id, created_at desc);
create index if not exists academy_student_invites_course_idx on public.academy_student_invites(course_id, created_at desc);
create index if not exists academy_student_invites_email_idx on public.academy_student_invites(lower(email));
create unique index if not exists academy_student_invites_open_unique
  on public.academy_student_invites(workspace_id, course_id, lower(email))
  where status <> 'cancelled';

alter table public.academy_student_invites enable row level security;

drop policy if exists academy_student_invites_staff_select on public.academy_student_invites;
create policy academy_student_invites_staff_select
on public.academy_student_invites for select to authenticated
using (private.can_view_academy_students(workspace_id));

drop policy if exists academy_student_invites_admin_insert on public.academy_student_invites;
create policy academy_student_invites_admin_insert
on public.academy_student_invites for insert to authenticated
with check (private.can_manage_academy_students(workspace_id));

drop policy if exists academy_student_invites_admin_update on public.academy_student_invites;
create policy academy_student_invites_admin_update
on public.academy_student_invites for update to authenticated
using (private.can_manage_academy_students(workspace_id))
with check (private.can_manage_academy_students(workspace_id));

drop policy if exists academy_student_invites_admin_delete on public.academy_student_invites;
create policy academy_student_invites_admin_delete
on public.academy_student_invites for delete to authenticated
using (private.can_manage_academy_students(workspace_id));

-- Staff can read only profiles belonging to students enrolled in their academy workspace.
drop policy if exists profiles_workspace_staff_view_students on public.profiles;
create policy profiles_workspace_staff_view_students
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.user_id = profiles.id
      and c.workspace_id is not null
      and private.can_view_academy_students(c.workspace_id)
  )
);

-- Enrollment administration is restricted to academy owner/admin. Instructors retain read access.
drop policy if exists enrollments_select_scoped on public.enrollments;
create policy enrollments_select_scoped
on public.enrollments for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.courses c
    where c.id = enrollments.course_id
      and c.workspace_id is not null
      and private.can_view_academy_students(c.workspace_id)
  )
);

drop policy if exists enrollments_insert_scoped on public.enrollments;
create policy enrollments_insert_scoped
on public.enrollments for insert to authenticated
with check (
  exists (
    select 1 from public.courses c
    where c.id = enrollments.course_id
      and c.workspace_id is not null
      and private.can_manage_academy_students(c.workspace_id)
  )
);

drop policy if exists enrollments_update_scoped on public.enrollments;
create policy enrollments_update_scoped
on public.enrollments for update to authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = enrollments.course_id
      and c.workspace_id is not null
      and private.can_manage_academy_students(c.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.courses c
    where c.id = enrollments.course_id
      and c.workspace_id is not null
      and private.can_manage_academy_students(c.workspace_id)
  )
);

drop policy if exists enrollments_delete_scoped on public.enrollments;
create policy enrollments_delete_scoped
on public.enrollments for delete to authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = enrollments.course_id
      and c.workspace_id is not null
      and private.can_manage_academy_students(c.workspace_id)
  )
);

create or replace function public.get_academy_student_directory(target_workspace uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  profile_status text,
  enrollment_id uuid,
  course_id uuid,
  course_title text,
  enrollment_status text,
  enrolled_at timestamptz,
  completed_at timestamptz,
  total_lessons bigint,
  completed_lessons bigint,
  progress_percent integer,
  last_activity timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.full_name,
    p.email,
    p.status,
    e.id,
    c.id,
    c.title,
    e.status,
    e.enrolled_at,
    e.completed_at,
    count(distinct l.id)::bigint as total_lessons,
    count(distinct l.id) filter (where lp.completed is true)::bigint as completed_lessons,
    case when count(distinct l.id)=0 then 0
      else round((count(distinct l.id) filter (where lp.completed is true)::numeric / count(distinct l.id)::numeric) * 100)::int
    end as progress_percent,
    max(lp.updated_at) as last_activity
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  join public.profiles p on p.id = e.user_id
  left join public.modules m on m.course_id = c.id
  left join public.lessons l on l.module_id = m.id
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
  where c.workspace_id = target_workspace
    and private.can_view_academy_students(target_workspace)
  group by p.id,p.full_name,p.email,p.status,e.id,c.id,c.title,e.status,e.enrolled_at,e.completed_at
  order by p.full_name nulls last,p.email,c.title;
$$;

revoke all on function public.get_academy_student_directory(uuid) from public;
grant execute on function public.get_academy_student_directory(uuid) to authenticated;

create or replace function public.set_academy_enrollment_status(target_enrollment uuid, target_status text)
returns public.enrollments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  row public.enrollments;
  ws uuid;
begin
  if target_status not in ('active','paused','completed','cancelled') then
    raise exception 'invalid_status';
  end if;

  select e into row
  from public.enrollments e
  where e.id=target_enrollment;

  if row.id is null then raise exception 'enrollment_not_found'; end if;

  select c.workspace_id into ws
  from public.courses c
  where c.id=row.course_id;

  if ws is null then raise exception 'workspace_not_found'; end if;
  if not private.can_manage_academy_students(ws) then raise exception 'forbidden'; end if;

  update public.enrollments
  set status=target_status,
      completed_at=case when target_status='completed' then coalesce(completed_at,now()) else null end
  where id=target_enrollment
  returning * into row;
  return row;
end;
$$;

revoke all on function public.set_academy_enrollment_status(uuid,text) from public;
grant execute on function public.set_academy_enrollment_status(uuid,text) to authenticated;

-- Correct inherited academy copy.
create or replace function private.notify_academy_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare course_title text;
begin
  if new.status='active' and (tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from new.status)) then
    select c.title into course_title from public.courses c where c.id=new.course_id;
    perform private.enqueue_academy_notification(
      new.user_id,
      'course_assigned',
      'Nuevo curso en tu ruta',
      coalesce(course_title,'Tu nuevo curso')||' ya está disponible en Academia Yamilet.',
      '#course/'||new.course_id::text,
      'course',new.course_id,
      'enrollment:'||new.id::text||':active'
    );
  end if;
  return new;
end;
$$;

grant select on public.academy_student_invites to authenticated;
grant insert,update,delete on public.academy_student_invites to authenticated;
