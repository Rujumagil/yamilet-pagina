-- Yamilet Academy P1 · Mínimo privilegio del LMS
-- RLS decide qué filas puede operar cada usuario; los grants limitan qué operaciones existen.

revoke all on public.courses from anon;
revoke all on public.enrollments from anon;
revoke all on public.modules from anon;
revoke all on public.lessons from anon;
revoke all on public.lesson_progress from anon;

revoke all on public.courses from authenticated;
revoke all on public.enrollments from authenticated;
revoke all on public.modules from authenticated;
revoke all on public.lessons from authenticated;
revoke all on public.lesson_progress from authenticated;

grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.enrollments to authenticated;
grant select, insert, update, delete on public.modules to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
