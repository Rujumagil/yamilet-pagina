-- Academia Yamilet · registros públicos pendientes de inscripción
-- Solo owner/admin del workspace puede consultar cuentas creadas desde el formulario público.

create or replace function public.get_academy_pending_registrations(target_workspace uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  registered_at timestamptz,
  email_confirmed_at timestamptz,
  profile_status text,
  registration_source text,
  course_interest text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_academy_students(target_workspace) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data ->> 'full_name', ''), '')::text,
    u.created_at,
    u.email_confirmed_at,
    coalesce(p.status, 'active')::text,
    coalesce(u.raw_user_meta_data ->> 'registration_source', '')::text,
    coalesce(u.raw_user_meta_data ->> 'course_interest', '')::text
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(u.raw_user_meta_data ->> 'academy', '') = 'yamilet'
    and coalesce(u.raw_user_meta_data ->> 'registration_source', '') = 'academy-public'
    and not exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.user_id = u.id
        and c.workspace_id = target_workspace
    )
  order by u.created_at desc;
end;
$$;

revoke all on function public.get_academy_pending_registrations(uuid) from public;
grant execute on function public.get_academy_pending_registrations(uuid) to authenticated;
