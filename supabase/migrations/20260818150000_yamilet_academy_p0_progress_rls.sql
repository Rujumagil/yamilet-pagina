-- Yamilet Academy P0
-- Endurece la escritura de progreso para que un alumno solo pueda registrar
-- avance en lecciones pertenecientes a cursos donde mantiene una inscripción
-- académica activa o completada.

begin;

alter table public.lesson_progress enable row level security;

drop policy if exists "Usuarios crean su progreso" on public.lesson_progress;
drop policy if exists "Usuarios actualizan su progreso" on public.lesson_progress;

create policy "Usuarios crean progreso en cursos autorizados"
on public.lesson_progress
for insert
to authenticated
with check (
  (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.course_id = m.course_id
      where l.id = lesson_progress.lesson_id
        and e.user_id = (select auth.uid())
        and e.status in ('active', 'completed')
    )
  )
  or (select private.is_admin())
);

create policy "Usuarios actualizan progreso en cursos autorizados"
on public.lesson_progress
for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
)
with check (
  (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.course_id = m.course_id
      where l.id = lesson_progress.lesson_id
        and e.user_id = (select auth.uid())
        and e.status in ('active', 'completed')
    )
  )
  or (select private.is_admin())
);

-- Acelera la resolución de "continuar aprendiendo" y última actividad.
create index if not exists lesson_progress_user_updated_idx
  on public.lesson_progress (user_id, updated_at desc);

commit;