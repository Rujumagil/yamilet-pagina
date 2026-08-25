create or replace function private.get_assessment_manager_options_impl(target_assessment uuid)
returns table(id uuid, question_id uuid, label text, is_correct boolean, option_position integer)
language plpgsql
security definer
set search_path = 'public'
as $$
declare target_course uuid;
begin
  select a.course_id into target_course from public.assessments a where a.id=target_assessment;
  if target_course is null or not private.can_manage_academy_course(target_course) then
    raise exception 'No autorizado para administrar esta evaluación';
  end if;
  return query
  select o.id,o.question_id,o.label,o.is_correct,o.position
  from public.assessment_options o
  join public.assessment_questions q on q.id=o.question_id
  where q.assessment_id=target_assessment
  order by q.position,o.position,o.id;
end;
$$;

create or replace function private.grade_assessment_attempt_impl(target_attempt uuid, manual_grades jsonb default '[]'::jsonb)
returns table(final_score numeric, final_passed boolean)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  at public.assessment_attempts%rowtype;
  a public.assessments%rowtype;
  q record;
  grade jsonb;
  awarded numeric;
  correct_flag boolean;
  total_points numeric:=0;
  earned_points numeric:=0;
  computed_score numeric;
  computed_passed boolean;
begin
  select * into at from public.assessment_attempts where id=target_attempt and status='submitted';
  if not found then raise exception 'El intento no está pendiente de revisión'; end if;
  select * into a from public.assessments where id=at.assessment_id;
  if not found or not private.can_manage_academy_course(a.course_id) then raise exception 'No autorizado para calificar este intento'; end if;

  for q in select * from public.assessment_questions where assessment_id=a.id order by position,id loop
    total_points:=total_points+q.points;
    if q.question_type='short_text' then
      grade:=null;
      select value into grade from jsonb_array_elements(coalesce(manual_grades,'[]'::jsonb)) value
      where value->>'question_id'=q.id::text limit 1;
      awarded:=coalesce((grade->>'points')::numeric,0);
      correct_flag:=coalesce((grade->>'correct')::boolean,false);
      if awarded<0 or awarded>q.points then raise exception 'Puntaje inválido para la pregunta %',q.id; end if;
      update public.assessment_answers
      set is_correct=correct_flag,points_awarded=awarded
      where attempt_id=at.id and question_id=q.id;
      earned_points:=earned_points+awarded;
    else
      earned_points:=earned_points+coalesce((select ans.points_awarded from public.assessment_answers ans where ans.attempt_id=at.id and ans.question_id=q.id),0);
    end if;
  end loop;

  computed_score:=case when total_points>0 then round((earned_points/total_points)*100,2) else 0 end;
  computed_passed:=computed_score>=a.passing_score;
  update public.assessment_attempts set status='graded',score=computed_score,passed=computed_passed,graded_at=now() where id=at.id;
  return query select computed_score,computed_passed;
end;
$$;

create or replace function private.validate_assessment_before_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  q record;
  option_count integer;
  correct_count integer;
begin
  if new.status <> 'published' or coalesce(old.status,'') = 'published' then
    return new;
  end if;

  if not exists(select 1 from public.assessment_questions q where q.assessment_id=new.id) then
    raise exception 'Agrega al menos una pregunta antes de publicar la evaluación';
  end if;

  for q in select * from public.assessment_questions where assessment_id=new.id loop
    if q.question_type in ('single_choice','multiple_choice','true_false') then
      select count(*),count(*) filter(where o.is_correct)
      into option_count,correct_count
      from public.assessment_options o where o.question_id=q.id;

      if option_count < 2 then
        raise exception 'Cada pregunta de opción debe tener al menos dos respuestas';
      end if;
      if correct_count < 1 then
        raise exception 'Cada pregunta de opción debe tener al menos una respuesta correcta';
      end if;
      if q.question_type in ('single_choice','true_false') and correct_count <> 1 then
        raise exception 'Las preguntas de respuesta única deben tener exactamente una respuesta correcta';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists assessment_publish_guard on public.assessments;
create trigger assessment_publish_guard
before update of status on public.assessments
for each row execute function private.validate_assessment_before_publish();
