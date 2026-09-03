-- Academia Yamilet v115 · vincular una solicitud pública con una cuenta ya existente por correo

create or replace function public.capture_academy_registration_request(
  target_email text,
  target_full_name text,
  target_locale text default 'es',
  target_page_url text default null,
  target_utm_source text default null,
  target_utm_medium text default null,
  target_utm_campaign text default null,
  target_utm_content text default null,
  target_utm_term text default null,
  target_landing_cta text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_id uuid;
  normalized_email text;
  normalized_name text;
  request_id uuid;
begin
  normalized_email := lower(btrim(coalesce(target_email,'')));
  normalized_name := btrim(regexp_replace(coalesce(target_full_name,''), '\s+', ' ', 'g'));

  if normalized_name = '' or length(normalized_name) < 2 or length(normalized_name) > 120 then raise exception 'invalid_name'; end if;
  if normalized_email = '' or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email'; end if;

  select w.id into workspace_id from public.workspaces w where w.slug='yamilet-mes' limit 1;
  if workspace_id is null then raise exception 'workspace_not_found'; end if;

  insert into public.academy_registration_requests (
    workspace_id,email,full_name,locale,registration_source,course_interest,page_url,
    utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_cta,request_status,updated_at
  ) values (
    workspace_id,normalized_email,normalized_name,case when target_locale='it' then 'it' else 'es' end,
    'academy-public','metodo-mes',left(coalesce(target_page_url,''),1000),
    left(coalesce(target_utm_source,''),255),left(coalesce(target_utm_medium,''),255),
    left(coalesce(target_utm_campaign,''),255),left(coalesce(target_utm_content,''),255),
    left(coalesce(target_utm_term,''),255),left(coalesce(target_landing_cta,''),255),'requested',now()
  )
  on conflict (workspace_id,email) do update set
    full_name=excluded.full_name, locale=excluded.locale, page_url=excluded.page_url,
    utm_source=excluded.utm_source, utm_medium=excluded.utm_medium, utm_campaign=excluded.utm_campaign,
    utm_content=excluded.utm_content, utm_term=excluded.utm_term, landing_cta=excluded.landing_cta,
    request_status=case when public.academy_registration_requests.user_id is null then 'requested'
      when public.academy_registration_requests.email_confirmed_at is not null then 'email_confirmed' else 'account_created' end,
    updated_at=now()
  returning id into request_id;

  update public.academy_registration_requests r
  set user_id=u.id,
      email_confirmed_at=u.email_confirmed_at,
      request_status=case when u.email_confirmed_at is not null then 'email_confirmed' else 'account_created' end,
      updated_at=now()
  from auth.users u
  where r.id=request_id
    and lower(u.email::text)=normalized_email
    and r.user_id is null;

  return request_id;
end;
$$;

revoke all on function public.capture_academy_registration_request(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.capture_academy_registration_request(text,text,text,text,text,text,text,text,text,text) to anon, authenticated;