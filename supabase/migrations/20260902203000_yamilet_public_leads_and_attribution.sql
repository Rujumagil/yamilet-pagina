-- Yamilet · captación pública + atribución de registros de Academia

create or replace function public.capture_yamilet_public_lead(
  target_email text,
  target_locale text default 'es',
  target_source text default 'yamilet-landing-newsletter',
  target_page_url text default null,
  target_utm_source text default null,
  target_utm_medium text default null,
  target_utm_campaign text default null,
  target_utm_content text default null,
  target_utm_term text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_id uuid;
  normalized_email text;
  contact_id uuid;
  meta_note text;
begin
  normalized_email := lower(btrim(coalesce(target_email,'')));
  if normalized_email = '' or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  select w.id into workspace_id
  from public.workspaces w
  where w.slug='yamilet-mes'
  limit 1;

  if workspace_id is null then
    raise exception 'workspace_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext(workspace_id::text), hashtext(normalized_email));

  meta_note := jsonb_build_object(
    'locale', case when target_locale='it' then 'it' else 'es' end,
    'page_url', left(coalesce(target_page_url,''),1000),
    'utm_source', left(coalesce(target_utm_source,''),255),
    'utm_medium', left(coalesce(target_utm_medium,''),255),
    'utm_campaign', left(coalesce(target_utm_campaign,''),255),
    'utm_content', left(coalesce(target_utm_content,''),255),
    'utm_term', left(coalesce(target_utm_term,''),255)
  )::text;

  select c.id into contact_id
  from public.contacts c
  where c.workspace_id=workspace_id
    and lower(c.email)=normalized_email
  order by c.created_at
  limit 1;

  if contact_id is null then
    insert into public.contacts(
      workspace_id, display_name, email, source, status, notes, last_contact_at
    ) values (
      workspace_id,
      split_part(normalized_email,'@',1),
      normalized_email,
      left(coalesce(nullif(btrim(target_source),''),'yamilet-landing-newsletter'),120),
      'lead',
      meta_note,
      now()
    ) returning id into contact_id;
  else
    update public.contacts
    set last_contact_at=now(),
        source=coalesce(nullif(source,''),left(coalesce(nullif(btrim(target_source),''),'yamilet-landing-newsletter'),120)),
        notes=case when notes is null or btrim(notes)='' then meta_note else notes end,
        updated_at=now()
    where id=contact_id;
  end if;

  return contact_id;
end;
$$;

revoke all on function public.capture_yamilet_public_lead(text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.capture_yamilet_public_lead(text,text,text,text,text,text,text,text,text) to anon, authenticated;

drop function if exists public.get_academy_pending_registrations(uuid);

create function public.get_academy_pending_registrations(target_workspace uuid)
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
