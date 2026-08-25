create or replace function private.validate_assessment_before_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_row record;
  option_count integer;
  correct_count integer;
begin
  if new.status <> 'published' or old.status = 'published' then
    return new;
  end if;

  if not exists(select 1 from public.assessment_questions aq where aq.assessment_id=new.id) then
    raise exception 'Agrega al menos una pregunta antes de publicar la evaluación';
  end if;

  for question_row in select * from public.assessment_questions aq where aq.assessment_id=new.id loop
    if question_row.question_type in ('single_choice','multiple_choice','true_false') then
      select count(*),count(*) filter(where ao.is_correct)
      into option_count,correct_count
      from public.assessment_options ao where ao.question_id=question_row.id;

      if option_count < 2 then
        raise exception 'Cada pregunta de opción debe tener al menos dos respuestas';
      end if;
      if correct_count < 1 then
        raise exception 'Cada pregunta de opción debe tener al menos una respuesta correcta';
      end if;
      if question_row.question_type in ('single_choice','true_false') and correct_count <> 1 then
        raise exception 'Las preguntas de respuesta única deben tener exactamente una respuesta correcta';
      end if;
    end if;
  end loop;

  return new;
end;
$$;
