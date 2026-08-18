-- Mantiene el cálculo privilegiado fuera del esquema API y expone solo un wrapper invoker.
alter function public.get_academy_recent_activity(uuid,integer) set schema private;
revoke all on function private.get_academy_recent_activity(uuid,integer) from public,anon;
grant execute on function private.get_academy_recent_activity(uuid,integer) to authenticated;

create function public.get_academy_recent_activity(target_workspace uuid,limit_count integer default 20)
returns table(activity_type text,title text,detail text,occurred_at timestamptz,target_path text)
language sql
set search_path=''
as $$ select * from private.get_academy_recent_activity(target_workspace,limit_count); $$;

revoke all on function public.get_academy_recent_activity(uuid,integer) from public,anon;
grant execute on function public.get_academy_recent_activity(uuid,integer) to authenticated;
