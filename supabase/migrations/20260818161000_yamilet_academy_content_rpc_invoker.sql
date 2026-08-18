-- Yamilet Academy P1.5 · RPC editoriales con SECURITY INVOKER
-- Las políticas RLS y private.can_manage_academy_course ya controlan el acceso.
-- No necesitamos elevar privilegios para publicación ni reordenamiento.

alter function public.set_academy_course_publication(uuid,text) security invoker;
alter function public.reorder_academy_modules(uuid,uuid[]) security invoker;
alter function public.reorder_academy_lessons(uuid,uuid[]) security invoker;
