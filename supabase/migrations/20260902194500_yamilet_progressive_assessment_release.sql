-- Academia Yamilet · liberación progresiva de evaluaciones
-- Alcance: únicamente cursos del workspace slug yamilet-mes.

create or replace function private.is_yamilet_assessment_unlocked(
  target_assessment uuid,
  target_user uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.assessments a
    join public.courses c on c.id = a.course_id
    join public.workspaces w on w.id = c.workspace_id
    where a.id = target_assessment
      and a.status = 'published'
      and exists (
        select 1
        from public.enrollments e
        where e.course_id = a.course_id
          and e.user_id = target_user
          and e.status in ('active','completed')
      )
      and (
        w.slug <> 'yamilet-mes'
        or a.module_id is null
        or not exists (
          select 1
          from public.lessons l
          where l.module_id = a.module_id
            and coalesce(l.lesson_type,'video') <> 'quiz'
            and not exists (
              select 1
              from public.lesson_progress lp
              where lp.lesson_id = l.id
                and lp.user_id = target_user
                and lp.completed = true
            )
        )
      )
  );
$function$;

grant execute on function private.is_yamilet_assessment_unlocked(uuid,uuid) to authenticated;

-- La alumna sólo ve evaluaciones publicadas y desbloqueadas por su progreso.
drop policy if exists assessments_select_scoped on public.assessments;
create policy assessments_select_scoped
on public.assessments
for select
to authenticated
using (
  private.can_manage_academy_course(course_id)
  or private.is_yamilet_assessment_unlocked(id,(select auth.uid()))
);

drop policy if exists assessment_questions_read_scoped on public.assessment_questions;
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
        or private.is_yamilet_assessment_unlocked(a.id,(select auth.uid()))
      )
  )
);

drop policy if exists assessment_options_read_scoped on public.assessment_options;
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
        or private.is_yamilet_assessment_unlocked(a.id,(select auth.uid()))
      )
  )
);

-- Bloqueo de seguridad también al iniciar un intento directo.
create or replace function private.start_assessment_attempt_impl(target_assessment uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  a public.assessments%rowtype;
  existing public.assessment_attempts%rowtype;
  next_attempt integer;
begin
  if uid is null then raise exception 'Autenticación requerida'; end if;

  select * into a
  from public.assessments
  where id = target_assessment and status = 'published';
  if not found then raise exception 'Evaluación no disponible'; end if;

  if not exists (
    select 1 from public.enrollments e
    where e.course_id = a.course_id
      and e.user_id = uid
      and e.status = 'active'
  ) then
    raise exception 'No tienes acceso a este curso';
  end if;

  if not private.is_yamilet_assessment_unlocked(a.id, uid) then
    raise exception 'Completa primero las lecciones de esta semana para desbloquear la evaluación';
  end if;

  select * into existing
  from public.assessment_attempts
  where assessment_id = a.id
    and user_id = uid
    and status = 'in_progress'
  order by started_at desc
  limit 1;

  if found then
    if a.time_limit_minutes is null
       or existing.started_at + make_interval(mins => a.time_limit_minutes) > now() then
      return existing.id;
    end if;
    update public.assessment_attempts
      set status = 'abandoned', submitted_at = now()
      where id = existing.id;
  end if;

  select coalesce(max(attempt_number),0)+1
    into next_attempt
  from public.assessment_attempts
  where assessment_id = a.id and user_id = uid;

  if a.max_attempts is not null and next_attempt > a.max_attempts then
    raise exception 'Ya utilizaste el número máximo de intentos';
  end if;

  insert into public.assessment_attempts(assessment_id,user_id,attempt_number,status)
  values(a.id,uid,next_attempt,'in_progress')
  returning id into existing.id;

  return existing.id;
end;
$function$;

-- Al publicar una evaluación, sólo notifica a quien ya la tenga desbloqueada.
create or replace function private.notify_academy_assessment_published()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  enrollment_item record;
begin
  if new.status='published'
     and (tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from new.status)) then
    for enrollment_item in
      select e.user_id
      from public.enrollments e
      where e.course_id = new.course_id
        and e.status in ('active','completed')
        and private.is_yamilet_assessment_unlocked(new.id,e.user_id)
    loop
      perform private.enqueue_academy_notification(
        enrollment_item.user_id,
        'assessment_available',
        'Nueva evaluación disponible',
        new.title || ' ya está disponible dentro de tu curso.',
        '#assessment/' || new.id::text,
        'assessment',
        new.id,
        'assessment:' || new.id::text || ':published'
      );
    end loop;
  end if;
  return new;
end;
$function$;

-- Cuando se completa la última lección requerida, avisa del desbloqueo.
create or replace function private.notify_yamilet_assessment_unlocked_from_progress()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  module_key uuid;
  assessment_item record;
begin
  if new.completed is not true then return new; end if;
  if tg_op='UPDATE' and old.completed is true then return new; end if;

  select l.module_id into module_key
  from public.lessons l
  where l.id = new.lesson_id;

  if module_key is null then return new; end if;

  for assessment_item in
    select a.id,a.title
    from public.assessments a
    join public.modules m on m.id = a.module_id
    join public.courses c on c.id = a.course_id
    join public.workspaces w on w.id = c.workspace_id
    where a.module_id = module_key
      and a.status = 'published'
      and w.slug = 'yamilet-mes'
      and private.is_yamilet_assessment_unlocked(a.id,new.user_id)
  loop
    perform private.enqueue_academy_notification(
      new.user_id,
      'assessment_available',
      'Nueva evaluación disponible',
      assessment_item.title || ' ya está disponible. Completaste las prácticas necesarias de esta semana.',
      '#assessment/' || assessment_item.id::text,
      'assessment',
      assessment_item.id,
      'assessment:' || assessment_item.id::text || ':unlocked:' || new.user_id::text
    );
  end loop;

  return new;
end;
$function$;

drop trigger if exists yamilet_assessment_unlock_notification on public.lesson_progress;
create trigger yamilet_assessment_unlock_notification
after insert or update of completed on public.lesson_progress
for each row
execute function private.notify_yamilet_assessment_unlocked_from_progress();
