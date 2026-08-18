-- Yamilet Academy P0 · Evaluaciones seguras por workspace
-- Objetivos:
-- 1. Evitar que un instructor/administrador de otro workspace administre evaluaciones ajenas.
-- 2. Impedir que alumnos escriban score, passed, is_correct o points_awarded directamente.
-- 3. Mantener los flujos de intento/respuesta/calificación exclusivamente mediante RPC seguras.
-- 4. No borrar evaluaciones, intentos ni respuestas existentes.

create or replace function private.can_manage_academy_course(target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = target_course
      and (
        private.is_admin()
        or c.created_by = (select auth.uid())
        or (
          c.workspace_id is not null
          and exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = c.workspace_id
              and wm.user_id = (select auth.uid())
              and wm.status = 'active'
              and wm.role in ('owner', 'admin', 'instructor')
          )
        )
      )
  );
$$;

revoke all on function private.can_manage_academy_course(uuid) from public;
grant execute on function private.can_manage_academy_course(uuid) to authenticated;

-- Assessments -----------------------------------------------------------------
drop policy if exists assessments_select on public.assessments;
drop policy if exists assessments_manager_insert on public.assessments;
drop policy if exists assessments_manager_update on public.assessments;
drop policy if exists assessments_manager_delete on public.assessments;

create policy assessments_select_scoped
on public.assessments
for select
to authenticated
using (
  private.can_manage_academy_course(course_id)
  or (
    status = 'published'
    and exists (
      select 1
      from public.enrollments e
      where e.course_id = assessments.course_id
        and e.user_id = (select auth.uid())
        and e.status in ('active', 'completed')
    )
  )
);

create policy assessments_manager_insert_scoped
on public.assessments
for insert
to authenticated
with check (private.can_manage_academy_course(course_id));

create policy assessments_manager_update_scoped
on public.assessments
for update
to authenticated
using (private.can_manage_academy_course(course_id))
with check (private.can_manage_academy_course(course_id));

create policy assessments_manager_delete_scoped
on public.assessments
for delete
to authenticated
using (private.can_manage_academy_course(course_id));

-- Questions -------------------------------------------------------------------
drop policy if exists assessment_questions_read on public.assessment_questions;
drop policy if exists assessment_questions_manager_insert on public.assessment_questions;
drop policy if exists assessment_questions_manager_update on public.assessment_questions;
drop policy if exists assessment_questions_manager_delete on public.assessment_questions;

create policy assessment_questions_read_scoped
on public.assessment_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_questions.assessment_id
      and (
        private.can_manage_academy_course(a.course_id)
        or (
          a.status = 'published'
          and exists (
            select 1
            from public.enrollments e
            where e.course_id = a.course_id
              and e.user_id = (select auth.uid())
              and e.status in ('active', 'completed')
          )
        )
      )
  )
);

create policy assessment_questions_manager_insert_scoped
on public.assessment_questions
for insert
to authenticated
with check (
  exists (
    select 1 from public.assessments a
    where a.id = assessment_questions.assessment_id
      and private.can_manage_academy_course(a.course_id)
  )
);

create policy assessment_questions_manager_update_scoped
on public.assessment_questions
for update
to authenticated
using (
  exists (
    select 1 from public.assessments a
    where a.id = assessment_questions.assessment_id
      and private.can_manage_academy_course(a.course_id)
  )
)
with check (
  exists (
    select 1 from public.assessments a
    where a.id = assessment_questions.assessment_id
      and private.can_manage_academy_course(a.course_id)
  )
);

create policy assessment_questions_manager_delete_scoped
on public.assessment_questions
for delete
to authenticated
using (
  exists (
    select 1 from public.assessments a
    where a.id = assessment_questions.assessment_id
      and private.can_manage_academy_course(a.course_id)
  )
);

-- Options ---------------------------------------------------------------------
drop policy if exists assessment_options_student_read on public.assessment_options;
drop policy if exists assessment_options_manager_insert on public.assessment_options;
drop policy if exists assessment_options_manager_update on public.assessment_options;
drop policy if exists assessment_options_manager_delete on public.assessment_options;

create policy assessment_options_read_scoped
on public.assessment_options
for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = assessment_options.question_id
      and (
        private.can_manage_academy_course(a.course_id)
        or (
          a.status = 'published'
          and exists (
            select 1
            from public.enrollments e
            where e.course_id = a.course_id
              and e.user_id = (select auth.uid())
              and e.status in ('active', 'completed')
          )
        )
      )
  )
);

create policy assessment_options_manager_insert_scoped
on public.assessment_options
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = assessment_options.question_id
      and private.can_manage_academy_course(a.course_id)
  )
);

create policy assessment_options_manager_update_scoped
on public.assessment_options
for update
to authenticated
using (
  exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = assessment_options.question_id
      and private.can_manage_academy_course(a.course_id)
  )
)
with check (
  exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = assessment_options.question_id
      and private.can_manage_academy_course(a.course_id)
  )
);

create policy assessment_options_manager_delete_scoped
on public.assessment_options
for delete
to authenticated
using (
  exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = assessment_options.question_id
      and private.can_manage_academy_course(a.course_id)
  )
);

-- is_correct jamás se entrega mediante SELECT directo a authenticated.
revoke select on public.assessment_options from authenticated;
grant select (id, question_id, label, position, created_at)
on public.assessment_options to authenticated;

-- Intentos --------------------------------------------------------------------
drop policy if exists assessment_attempts_insert on public.assessment_attempts;
drop policy if exists assessment_attempts_update on public.assessment_attempts;
drop policy if exists assessment_attempts_read on public.assessment_attempts;

create policy assessment_attempts_read_scoped
on public.assessment_attempts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.assessments a
    where a.id = assessment_attempts.assessment_id
      and private.can_manage_academy_course(a.course_id)
  )
);

-- El alumno inicia/entrega intentos por RPC; no puede escribir score/passed.
revoke insert, update, delete on public.assessment_attempts from authenticated;

-- Respuestas ------------------------------------------------------------------
drop policy if exists assessment_answers_insert on public.assessment_answers;
drop policy if exists assessment_answers_update on public.assessment_answers;
drop policy if exists assessment_answers_delete on public.assessment_answers;
drop policy if exists assessment_answers_read on public.assessment_answers;

create policy assessment_answers_read_scoped
on public.assessment_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_attempts aa
    join public.assessments a on a.id = aa.assessment_id
    where aa.id = assessment_answers.attempt_id
      and (
        aa.user_id = (select auth.uid())
        or private.can_manage_academy_course(a.course_id)
      )
  )
);

-- El alumno guarda respuestas por RPC; no puede escribir is_correct/points_awarded.
revoke insert, update, delete on public.assessment_answers from authenticated;

-- Anónimo no debe operar el motor de evaluaciones.
revoke all on public.assessments from anon;
revoke all on public.assessment_questions from anon;
revoke all on public.assessment_options from anon;
revoke all on public.assessment_attempts from anon;
revoke all on public.assessment_answers from anon;

-- RPC públicas autorizadas para usuarios autenticados.
revoke all on function public.start_assessment_attempt(uuid) from public, anon;
revoke all on function public.save_assessment_answer(uuid, uuid, uuid[], text) from public, anon;
revoke all on function public.submit_assessment_attempt(uuid) from public, anon;
revoke all on function public.grade_assessment_attempt(uuid, jsonb) from public, anon;
revoke all on function public.get_assessment_manager_options(uuid) from public, anon;

grant execute on function public.start_assessment_attempt(uuid) to authenticated;
grant execute on function public.save_assessment_answer(uuid, uuid, uuid[], text) to authenticated;
grant execute on function public.submit_assessment_attempt(uuid) to authenticated;
grant execute on function public.grade_assessment_attempt(uuid, jsonb) to authenticated;
grant execute on function public.get_assessment_manager_options(uuid) to authenticated;
