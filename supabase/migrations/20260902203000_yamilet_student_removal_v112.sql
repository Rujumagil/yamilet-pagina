-- Academia Yamilet · retiro seguro de estudiantes v112
-- Permite retirar accesos del workspace sin borrar la cuenta global.
-- El borrado permanente se realiza mediante una Edge Function autenticada.

create table if not exists public.academy_removed_students (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  removed_by uuid references auth.users(id) on delete set null,
  reason text,
  removed_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.academy_removed_students enable row level security;
revoke all on table public.academy_removed_students from anon, authenticated;

create or replace function public.remove_academy_student_from_workspace(
  target_workspace uuid,
  target_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  enrollment_count integer := 0;
  resource_count integer := 0;
  product_access_count integer := 0;
begin
  if actor is null then
    raise exception 'authentication_required';
  end if;

  if not private.can_manage_academy_students(target_workspace) then
    raise exception 'not_authorized';
  end if;

  if target_user is null or target_user = actor then
    raise exception 'protected_user';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = target_user
      and p.role = 'admin'
  ) then
    raise exception 'protected_user';
  end if;

  if exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = target_user
      and wm.status = 'active'
      and wm.role in ('owner','admin','instructor')
  ) then
    raise exception 'protected_user';
  end if;

  if not exists (select 1 from public.profiles p where p.id = target_user) then
    raise exception 'user_not_found';
  end if;

  delete from public.resource_access ra
  where ra.user_id = target_user
    and exists (
      select 1
      from public.resources r
      left join public.courses c on c.id = r.course_id
      where r.id = ra.resource_id
        and (r.workspace_id = target_workspace or c.workspace_id = target_workspace)
    );
  get diagnostics resource_count = row_count;

  delete from public.student_access sa
  where sa.user_id = target_user
    and exists (
      select 1 from public.products p
      where p.id = sa.product_id
        and p.workspace_id = target_workspace
    );
  get diagnostics product_access_count = row_count;

  delete from public.enrollments e
  where e.user_id = target_user
    and exists (
      select 1 from public.courses c
      where c.id = e.course_id
        and c.workspace_id = target_workspace
    );
  get diagnostics enrollment_count = row_count;

  update public.academy_student_invites
  set status = 'cancelled',
      error_message = 'Acceso retirado desde Administración'
  where workspace_id = target_workspace
    and user_id = target_user
    and status <> 'cancelled';

  insert into public.academy_removed_students(workspace_id,user_id,removed_by,reason,removed_at)
  values(target_workspace,target_user,actor,'Retirado desde Administración',now())
  on conflict(workspace_id,user_id)
  do update set removed_by=excluded.removed_by,reason=excluded.reason,removed_at=excluded.removed_at;

  return jsonb_build_object(
    'ok', true,
    'user_id', target_user,
    'enrollments_removed', enrollment_count,
    'resource_access_removed', resource_count,
    'product_access_removed', product_access_count
  );
end;
$$;

revoke all on function public.remove_academy_student_from_workspace(uuid,uuid) from public;
grant execute on function public.remove_academy_student_from_workspace(uuid,uuid) to authenticated;

create or replace function private.clear_academy_removed_student_on_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace uuid;
begin
  select c.workspace_id into target_workspace
  from public.courses c
  where c.id = new.course_id;

  if target_workspace is not null then
    delete from public.academy_removed_students ars
    where ars.workspace_id = target_workspace
      and ars.user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists clear_academy_removed_student_on_enrollment on public.enrollments;
create trigger clear_academy_removed_student_on_enrollment
after insert or update of status on public.enrollments
for each row execute function private.clear_academy_removed_student_on_enrollment();

-- Mantener registros retirados fuera de la bandeja de nuevos registros.
create or replace function public.get_academy_pending_registrations(target_workspace uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  registered_at timestamptz,
  email_confirmed_at timestamptz,
  profile_status text,
  registration_source text,
  course_interest text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_cta text
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
    coalesce(u.raw_user_meta_data ->> 'course_interest', '')::text,
    coalesce(u.raw_user_meta_data ->> 'utm_source', '')::text,
    coalesce(u.raw_user_meta_data ->> 'utm_medium', '')::text,
    coalesce(u.raw_user_meta_data ->> 'utm_campaign', '')::text,
    coalesce(u.raw_user_meta_data ->> 'utm_content', '')::text,
    coalesce(u.raw_user_meta_data ->> 'utm_term', '')::text,
    coalesce(u.raw_user_meta_data ->> 'landing_cta', '')::text
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(u.raw_user_meta_data ->> 'academy', '') in ('yamilet','yamilet-mes')
    and coalesce(u.raw_user_meta_data ->> 'registration_source', 'academy-public') = 'academy-public'
    and not exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.user_id = u.id
        and c.workspace_id = target_workspace
    )
    and not exists (
      select 1
      from public.academy_removed_students ars
      where ars.workspace_id = target_workspace
        and ars.user_id = u.id
    )
  order by u.created_at desc;
end;
$$;

revoke all on function public.get_academy_pending_registrations(uuid) from public;
grant execute on function public.get_academy_pending_registrations(uuid) to authenticated;
