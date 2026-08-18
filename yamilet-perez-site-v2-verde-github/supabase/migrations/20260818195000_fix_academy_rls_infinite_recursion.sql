-- Corrige la recursión RLS courses <-> enrollments y profiles -> enrollments.
-- Los helpers SECURITY DEFINER realizan únicamente comprobaciones booleanas de permisos.

create schema if not exists private;

create or replace function private.current_user_is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function private.current_user_has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
  );
$$;

create or replace function private.current_user_is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  );
$$;

create or replace function private.current_user_has_active_enrollment(target_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    where e.course_id = target_course
      and e.user_id = (select auth.uid())
      and e.status in ('active','completed')
  );
$$;

create or replace function private.current_user_can_view_course_students(target_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_is_platform_admin()
    or exists (
      select 1
      from public.courses c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = target_course
        and wm.user_id = (select auth.uid())
        and wm.status = 'active'
        and wm.role in ('owner','admin','instructor')
    );
$$;

create or replace function private.current_user_can_manage_course_students(target_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_is_platform_admin()
    or exists (
      select 1
      from public.courses c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = target_course
        and wm.user_id = (select auth.uid())
        and wm.status = 'active'
        and wm.role in ('owner','admin')
    );
$$;

create or replace function private.current_user_can_view_student_profile(target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_is_platform_admin()
    or exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where e.user_id = target_user
        and wm.user_id = (select auth.uid())
        and wm.status = 'active'
        and wm.role in ('owner','admin','instructor')
    );
$$;

create or replace function private.current_user_can_manage_course(target_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_is_platform_admin()
    or exists (
      select 1 from public.courses c
      where c.id = target_course
        and (
          c.created_by = (select auth.uid())
          or exists (
            select 1 from public.workspace_members wm
            where wm.workspace_id = c.workspace_id
              and wm.user_id = (select auth.uid())
              and wm.status = 'active'
              and wm.role in ('owner','admin','instructor')
          )
        )
    );
$$;

revoke all on function private.current_user_is_platform_admin() from public;
revoke all on function private.current_user_has_workspace_role(uuid,text[]) from public;
revoke all on function private.current_user_is_workspace_member(uuid) from public;
revoke all on function private.current_user_has_active_enrollment(uuid) from public;
revoke all on function private.current_user_can_view_course_students(uuid) from public;
revoke all on function private.current_user_can_manage_course_students(uuid) from public;
revoke all on function private.current_user_can_view_student_profile(uuid) from public;
revoke all on function private.current_user_can_manage_course(uuid) from public;

grant execute on function private.current_user_is_platform_admin() to authenticated;
grant execute on function private.current_user_has_workspace_role(uuid,text[]) to authenticated;
grant execute on function private.current_user_is_workspace_member(uuid) to authenticated;
grant execute on function private.current_user_has_active_enrollment(uuid) to authenticated;
grant execute on function private.current_user_can_view_course_students(uuid) to authenticated;
grant execute on function private.current_user_can_manage_course_students(uuid) to authenticated;
grant execute on function private.current_user_can_view_student_profile(uuid) to authenticated;
grant execute on function private.current_user_can_manage_course(uuid) to authenticated;

drop policy if exists "Usuarios ven su propio perfil" on public.profiles;
drop policy if exists "profiles_workspace_staff_view_students" on public.profiles;
drop policy if exists "profiles_select_academy_safe" on public.profiles;
create policy "profiles_select_academy_safe" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or private.current_user_is_platform_admin()
  or private.current_user_can_view_student_profile(id)
);

drop policy if exists "workspace_select_member_or_admin" on public.workspaces;
create policy "workspace_select_member_or_admin" on public.workspaces
for select to authenticated
using (
  private.current_user_is_platform_admin()
  or created_by = (select auth.uid())
  or private.current_user_is_workspace_member(id)
);

drop policy if exists "workspace_update_manager" on public.workspaces;
create policy "workspace_update_manager" on public.workspaces
for update to authenticated
using (
  private.current_user_is_platform_admin()
  or created_by = (select auth.uid())
  or private.current_user_has_workspace_role(id, array['owner','admin']::text[])
)
with check (
  private.current_user_is_platform_admin()
  or created_by = (select auth.uid())
  or private.current_user_has_workspace_role(id, array['owner','admin']::text[])
);

drop policy if exists "courses_select_learning" on public.courses;
create policy "courses_select_learning" on public.courses
for select to authenticated
using (
  private.current_user_can_manage_course(id)
  or (status = 'published' and private.current_user_has_active_enrollment(id))
);

drop policy if exists "courses_update_staff" on public.courses;
create policy "courses_update_staff" on public.courses
for update to authenticated
using (private.current_user_can_manage_course(id))
with check (private.current_user_can_manage_course(id));

drop policy if exists "courses_delete_staff" on public.courses;
create policy "courses_delete_staff" on public.courses
for delete to authenticated
using (private.current_user_can_manage_course(id));

drop policy if exists "enrollments_select_scoped" on public.enrollments;
create policy "enrollments_select_scoped" on public.enrollments
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.current_user_can_view_course_students(course_id)
);

drop policy if exists "enrollments_insert_scoped" on public.enrollments;
create policy "enrollments_insert_scoped" on public.enrollments
for insert to authenticated
with check (private.current_user_can_manage_course_students(course_id));

drop policy if exists "enrollments_update_scoped" on public.enrollments;
create policy "enrollments_update_scoped" on public.enrollments
for update to authenticated
using (private.current_user_can_manage_course_students(course_id))
with check (private.current_user_can_manage_course_students(course_id));

drop policy if exists "enrollments_delete_scoped" on public.enrollments;
create policy "enrollments_delete_scoped" on public.enrollments
for delete to authenticated
using (private.current_user_can_manage_course_students(course_id));
