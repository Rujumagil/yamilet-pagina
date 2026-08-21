-- Academia Yamilet v30
-- Las alumnas inscritas deben poder leer la configuración de su Academia
-- y la ficha del curso, aunque no sean miembros administrativos del workspace.
-- Los módulos/lecciones de cursos en borrador continúan protegidos por sus RLS.

drop policy if exists workspace_select_member_or_admin on public.workspaces;
drop policy if exists workspace_select_academy_access on public.workspaces;
create policy workspace_select_academy_access
on public.workspaces
for select
to authenticated
using (
  private.current_user_is_platform_admin()
  or created_by = (select auth.uid())
  or private.can_access_academy_workspace(id)
);

drop policy if exists courses_select_learning on public.courses;
create policy courses_select_learning
on public.courses
for select
to authenticated
using (
  private.current_user_can_manage_course(id)
  or private.current_user_has_active_enrollment(id)
);

drop policy if exists academy_events_select_scoped on public.academy_events;
create policy academy_events_select_scoped
on public.academy_events
for select
to authenticated
using (
  private.current_user_has_workspace_role(
    workspace_id,
    array['owner'::text, 'admin'::text, 'instructor'::text]
  )
  or (
    status = 'published'
    and private.can_access_academy_workspace(workspace_id)
  )
);
