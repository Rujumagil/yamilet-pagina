create or replace function private.guard_published_assessment_question_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aid uuid := coalesce(new.assessment_id, old.assessment_id);
  current_status text;
begin
  select a.status into current_status from public.assessments a where a.id=aid;
  if current_status='published' then
    raise exception 'Pasa la evaluación a borrador antes de modificar sus preguntas';
  end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists assessment_question_published_lock on public.assessment_questions;
create trigger assessment_question_published_lock
before insert or update or delete on public.assessment_questions
for each row execute function private.guard_published_assessment_question_content();

create or replace function private.guard_published_assessment_option_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  qid uuid := coalesce(new.question_id, old.question_id);
  current_status text;
begin
  select a.status into current_status
  from public.assessment_questions q
  join public.assessments a on a.id=q.assessment_id
  where q.id=qid;
  if current_status='published' then
    raise exception 'Pasa la evaluación a borrador antes de modificar sus respuestas';
  end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists assessment_option_published_lock on public.assessment_options;
create trigger assessment_option_published_lock
before insert or update or delete on public.assessment_options
for each row execute function private.guard_published_assessment_option_content();
