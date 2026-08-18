-- Yamilet Academy P1.5 · Cursos administrables solo por staff editorial activo

drop policy if exists courses_insert_consolidated on public.courses;
drop policy if exists courses_update_consolidated on public.courses;
drop policy if exists courses_delete_consolidated on public.courses;
drop policy if exists courses_insert_staff on public.courses;
drop policy if exists courses_update_staff on public.courses;
drop policy if exists courses_delete_staff on public.courses;

create policy courses_insert_staff
on public.courses
for insert
to authenticated
with check (
  private.is_admin()
  or (
    workspace_id is not null
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = courses.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.status = 'active'
        and wm.role in ('owner','admin','instructor')
    )
  )
);

create policy courses_update_staff
on public.courses
for update
to authenticated
using (private.can_manage_academy_course(id))
with check (private.can_manage_academy_course(id));

create policy courses_delete_staff
on public.courses
for delete
to authenticated
using (private.can_manage_academy_course(id));
