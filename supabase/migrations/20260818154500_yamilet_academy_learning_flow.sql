-- Yamilet Academy P1 · Flujo de aprendizaje
-- Cursos -> Inscripciones -> Módulos -> Lecciones -> Progreso
-- No crea contenido académico ni elimina datos existentes.

-- 1) Los alumnos solo ven cursos publicados en los que tienen acceso.
drop policy if exists courses_select_consolidated on public.courses;
create policy courses_select_learning
on public.courses
for select
to authenticated
using (
  private.can_manage_academy_course(id)
  or (
    status = 'published'
    and exists (
      select 1
      from public.enrollments e
      where e.course_id = courses.id
        and e.user_id = (select auth.uid())
        and e.status in ('active', 'completed')
    )
  )
);

-- 2) Inscripciones: el alumno ve la propia; el staff del curso administra.
drop policy if exists "Usuarios ven sus inscripciones" on public.enrollments;
drop policy if exists enrollments_admin_insert on public.enrollments;
drop policy if exists enrollments_admin_update on public.enrollments;
drop policy if exists enrollments_admin_delete on public.enrollments;

create policy enrollments_select_scoped
on public.enrollments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_manage_academy_course(course_id)
);

create policy enrollments_insert_scoped
on public.enrollments
for insert
to authenticated
with check (private.can_manage_academy_course(course_id));

create policy enrollments_update_scoped
on public.enrollments
for update
to authenticated
using (private.can_manage_academy_course(course_id))
with check (private.can_manage_academy_course(course_id));

create policy enrollments_delete_scoped
on public.enrollments
for delete
to authenticated
using (private.can_manage_academy_course(course_id));

-- 3) Módulos: alumnos únicamente dentro de cursos publicados autorizados.
drop policy if exists modules_select_consolidated on public.modules;
drop policy if exists modules_insert_consolidated on public.modules;
drop policy if exists modules_update_consolidated on public.modules;
drop policy if exists modules_delete_consolidated on public.modules;

create policy modules_select_learning
on public.modules
for select
to authenticated
using (
  private.can_manage_academy_course(course_id)
  or exists (
    select 1
    from public.courses c
    join public.enrollments e on e.course_id = c.id
    where c.id = modules.course_id
      and c.status = 'published'
      and e.user_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

create policy modules_insert_learning
on public.modules
for insert
to authenticated
with check (private.can_manage_academy_course(course_id));

create policy modules_update_learning
on public.modules
for update
to authenticated
using (private.can_manage_academy_course(course_id))
with check (private.can_manage_academy_course(course_id));

create policy modules_delete_learning
on public.modules
for delete
to authenticated
using (private.can_manage_academy_course(course_id));

-- 4) Lecciones: heredan autorización del curso del módulo.
drop policy if exists lessons_select_consolidated on public.lessons;
drop policy if exists lessons_insert_consolidated on public.lessons;
drop policy if exists lessons_update_consolidated on public.lessons;
drop policy if exists lessons_delete_consolidated on public.lessons;

create policy lessons_select_learning
on public.lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.modules m
    join public.courses c on c.id = m.course_id
    where m.id = lessons.module_id
      and (
        private.can_manage_academy_course(c.id)
        or (
          c.status = 'published'
          and exists (
            select 1
            from public.enrollments e
            where e.course_id = c.id
              and e.user_id = (select auth.uid())
              and e.status in ('active', 'completed')
          )
        )
      )
  )
);

create policy lessons_insert_learning
on public.lessons
for insert
to authenticated
with check (
  exists (
    select 1 from public.modules m
    where m.id = lessons.module_id
      and private.can_manage_academy_course(m.course_id)
  )
);

create policy lessons_update_learning
on public.lessons
for update
to authenticated
using (
  exists (
    select 1 from public.modules m
    where m.id = lessons.module_id
      and private.can_manage_academy_course(m.course_id)
  )
)
with check (
  exists (
    select 1 from public.modules m
    where m.id = lessons.module_id
      and private.can_manage_academy_course(m.course_id)
  )
);

create policy lessons_delete_learning
on public.lessons
for delete
to authenticated
using (
  exists (
    select 1 from public.modules m
    where m.id = lessons.module_id
      and private.can_manage_academy_course(m.course_id)
  )
);

-- 5) Progreso: el alumno escribe únicamente su progreso en cursos publicados
-- autorizados. El staff puede consultar progreso, pero no falsificarlo desde el cliente.
drop policy if exists "Usuarios ven su progreso" on public.lesson_progress;
drop policy if exists "Usuarios crean progreso en cursos autorizados" on public.lesson_progress;
drop policy if exists "Usuarios actualizan progreso en cursos autorizados" on public.lesson_progress;

create policy lesson_progress_select_learning
on public.lesson_progress
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where l.id = lesson_progress.lesson_id
      and private.can_manage_academy_course(m.course_id)
  )
);

create policy lesson_progress_insert_learning
on public.lesson_progress
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    join public.enrollments e on e.course_id = c.id
    where l.id = lesson_progress.lesson_id
      and c.status = 'published'
      and e.user_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

create policy lesson_progress_update_learning
on public.lesson_progress
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    join public.enrollments e on e.course_id = c.id
    where l.id = lesson_progress.lesson_id
      and c.status = 'published'
      and e.user_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

-- 6) Mantener el estado de inscripción alineado al progreso real.
create or replace function private.sync_enrollment_from_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  target_course uuid;
  total_lessons integer;
  completed_lessons integer;
begin
  target_user := new.user_id;

  select m.course_id into target_course
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = new.lesson_id;

  if target_course is null then
    return new;
  end if;

  select count(*) into total_lessons
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where m.course_id = target_course;

  select count(*) into completed_lessons
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  where lp.user_id = target_user
    and m.course_id = target_course
    and lp.completed = true;

  if total_lessons > 0 and completed_lessons >= total_lessons then
    update public.enrollments
       set status = 'completed',
           completed_at = coalesce(completed_at, now())
     where user_id = target_user
       and course_id = target_course
       and status in ('active', 'completed');
  else
    update public.enrollments
       set status = 'active',
           completed_at = null
     where user_id = target_user
       and course_id = target_course
       and status = 'completed';
  end if;

  return new;
end;
$$;

revoke all on function private.sync_enrollment_from_lesson_progress() from public;

drop trigger if exists sync_enrollment_after_lesson_progress on public.lesson_progress;
create trigger sync_enrollment_after_lesson_progress
after insert or update of completed on public.lesson_progress
for each row execute function private.sync_enrollment_from_lesson_progress();

-- 7) Índices para temario, continuar aprendiendo y panel de progreso.
create index if not exists enrollments_course_status_user_idx
  on public.enrollments(course_id, status, user_id);

create index if not exists lesson_progress_user_completed_updated_idx
  on public.lesson_progress(user_id, completed, updated_at desc);
