create or replace function private.certificate_eligibility_for_user(target_user uuid, target_course uuid)
returns table(total_lessons integer, completed_lessons integer, required_assessments integer, passed_assessments integer, eligible boolean)
language plpgsql
security definer
set search_path to ''
as $$
begin
  select count(*)::integer into total_lessons
  from public.lessons l
  join public.modules m on m.id=l.module_id
  where m.course_id=target_course;

  select count(distinct lp.lesson_id)::integer into completed_lessons
  from public.lesson_progress lp
  join public.lessons l on l.id=lp.lesson_id
  join public.modules m on m.id=l.module_id
  where m.course_id=target_course
    and lp.user_id=target_user
    and lp.completed=true;

  select count(*)::integer into required_assessments
  from public.assessments a
  where a.course_id=target_course
    and a.status='published';

  select count(*)::integer into passed_assessments
  from public.assessments a
  where a.course_id=target_course
    and a.status='published'
    and exists(
      select 1
      from public.assessment_attempts aa
      where aa.assessment_id=a.id
        and aa.user_id=target_user
        and aa.status='graded'
        and aa.passed=true
    );

  eligible := total_lessons > 0
    and completed_lessons >= total_lessons
    and required_assessments > 0
    and passed_assessments >= required_assessments;

  return next;
end;
$$;
