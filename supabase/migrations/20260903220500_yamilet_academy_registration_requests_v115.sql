-- Academia Yamilet v115 · registro público persistente y visible para administración

create table if not exists public.academy_registration_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text not null default '',
  locale text not null default 'es',
  registration_source text not null default 'academy-public',
  course_interest text not null default 'metodo-mes',
  page_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_cta text,
  email_confirmed_at timestamptz,
  request_status text not null default 'requested' check (request_status in ('requested','account_created','email_confirmed','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

alter table public.academy_registration_requests enable row level security;
revoke all on table public.academy_registration_requests from anon, authenticated;

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

  if normalized_name = '' or length(normalized_name) < 2 or length(normalized_name) > 120 then
    raise exception 'invalid_name';
  end if;
  if normalized_email = '' or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  select w.id into workspace_id
  from public.workspaces w
  where w.slug = 'yamilet-mes'
  limit 1;

  if workspace_id is null then
    raise exception 'workspace_not_found';
  end if;

  insert into public.academy_registration_requests (
    workspace_id,email,full_name,locale,registration_source,course_interest,page_url,
    utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_cta,request_status,updated_at
  ) values (
    workspace_id,normalized_email,normalized_name,
    case when target_locale='it' then 'it' else 'es' end,
    'academy-public','metodo-mes',left(coalesce(target_page_url,''),1000),
    left(coalesce(target_utm_source,''),255),left(coalesce(target_utm_medium,''),255),
    left(coalesce(target_utm_campaign,''),255),left(coalesce(target_utm_content,''),255),
    left(coalesce(target_utm_term,''),255),left(coalesce(target_landing_cta,''),255),
    'requested',now()
  )
  on conflict (workspace_id,email) do update set
    full_name = excluded.full_name,
    locale = excluded.locale,
    page_url = excluded.page_url,
    utm_source = excluded.utm_source,
    utm_medium = excluded.utm_medium,
    utm_campaign = excluded.utm_campaign,
    utm_content = excluded.utm_content,
    utm_term = excluded.utm_term,
    landing_cta = excluded.landing_cta,
    request_status = case
      when public.academy_registration_requests.user_id is null then 'requested'
      when public.academy_registration_requests.email_confirmed_at is not null then 'email_confirmed'
      else 'account_created'
    end,
    updated_at = now()
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.capture_academy_registration_request(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.capture_academy_registration_request(text,text,text,text,text,text,text,text,text,text) to anon, authenticated;

create or replace function private.sync_yamilet_registration_request_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_id uuid;
  normalized_email text;
  normalized_name text;
begin
  if coalesce(new.raw_user_meta_data ->> 'academy','') <> 'yamilet'
     or coalesce(new.raw_user_meta_data ->> 'registration_source','') <> 'academy-public' then
    return new;
  end if;

  select w.id into workspace_id
  from public.workspaces w
  where w.slug='yamilet-mes'
  limit 1;
  if workspace_id is null then return new; end if;

  normalized_email := lower(btrim(coalesce(new.email::text,'')));
  normalized_name := btrim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'full_name',''), '\s+', ' ', 'g'));
  if normalized_email = '' then return new; end if;

  insert into public.academy_registration_requests (
    workspace_id,user_id,email,full_name,locale,registration_source,course_interest,page_url,
    utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_cta,email_confirmed_at,request_status,updated_at
  ) values (
    workspace_id,new.id,normalized_email,normalized_name,
    case when coalesce(new.raw_user_meta_data ->> 'locale','es')='it' then 'it' else 'es' end,
    'academy-public',coalesce(nullif(new.raw_user_meta_data ->> 'course_interest',''),'metodo-mes'),
    left(coalesce(new.raw_user_meta_data ->> 'page_url',''),1000),
    left(coalesce(new.raw_user_meta_data ->> 'utm_source',''),255),left(coalesce(new.raw_user_meta_data ->> 'utm_medium',''),255),
    left(coalesce(new.raw_user_meta_data ->> 'utm_campaign',''),255),left(coalesce(new.raw_user_meta_data ->> 'utm_content',''),255),
    left(coalesce(new.raw_user_meta_data ->> 'utm_term',''),255),left(coalesce(new.raw_user_meta_data ->> 'landing_cta',''),255),
    new.email_confirmed_at,
    case when new.email_confirmed_at is not null then 'email_confirmed' else 'account_created' end,
    now()
  )
  on conflict (workspace_id,email) do update set
    user_id = excluded.user_id,
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.academy_registration_requests.full_name end,
    course_interest = excluded.course_interest,
    email_confirmed_at = excluded.email_confirmed_at,
    request_status = excluded.request_status,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists yamilet_registration_request_sync on auth.users;
create trigger yamilet_registration_request_sync
after insert or update of email_confirmed_at, raw_user_meta_data on auth.users
for each row execute function private.sync_yamilet_registration_request_from_auth();

insert into public.academy_registration_requests (
  workspace_id,user_id,email,full_name,locale,registration_source,course_interest,page_url,
  utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_cta,email_confirmed_at,request_status,created_at,updated_at
)
select
  w.id,u.id,lower(u.email::text),coalesce(nullif(u.raw_user_meta_data ->> 'full_name',''),''),
  case when coalesce(u.raw_user_meta_data ->> 'locale','es')='it' then 'it' else 'es' end,
  'academy-public',coalesce(nullif(u.raw_user_meta_data ->> 'course_interest',''),'metodo-mes'),
  left(coalesce(u.raw_user_meta_data ->> 'page_url',''),1000),
  left(coalesce(u.raw_user_meta_data ->> 'utm_source',''),255),left(coalesce(u.raw_user_meta_data ->> 'utm_medium',''),255),
  left(coalesce(u.raw_user_meta_data ->> 'utm_campaign',''),255),left(coalesce(u.raw_user_meta_data ->> 'utm_content',''),255),
  left(coalesce(u.raw_user_meta_data ->> 'utm_term',''),255),left(coalesce(u.raw_user_meta_data ->> 'landing_cta',''),255),
  u.email_confirmed_at,case when u.email_confirmed_at is not null then 'email_confirmed' else 'account_created' end,
  u.created_at,now()
from auth.users u
join public.workspaces w on w.slug='yamilet-mes'
where coalesce(u.raw_user_meta_data ->> 'academy','')='yamilet'
  and coalesce(u.raw_user_meta_data ->> 'registration_source','')='academy-public'
on conflict (workspace_id,email) do update set
  user_id=excluded.user_id,
  email_confirmed_at=excluded.email_confirmed_at,
  request_status=excluded.request_status,
  updated_at=now();

create or replace function public.get_academy_registration_requests(target_workspace uuid)
returns table (
  request_id uuid,
  user_id uuid,
  email text,
  full_name text,
  registered_at timestamptz,
  email_confirmed_at timestamptz,
  request_status text,
  registration_source text,
  course_interest text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_cta text,
  account_created boolean
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
    r.id,r.user_id,r.email,r.full_name,r.created_at,r.email_confirmed_at,r.request_status,
    r.registration_source,r.course_interest,r.utm_source,r.utm_medium,r.utm_campaign,
    r.utm_content,r.utm_term,r.landing_cta,(r.user_id is not null)
  from public.academy_registration_requests r
  where r.workspace_id=target_workspace
    and r.request_status <> 'dismissed'
    and not exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id=e.course_id
      where r.user_id is not null
        and e.user_id=r.user_id
        and c.workspace_id=target_workspace
    )
  order by r.created_at desc;
end;
$$;

revoke all on function public.get_academy_registration_requests(uuid) from public;
grant execute on function public.get_academy_registration_requests(uuid) to authenticated;