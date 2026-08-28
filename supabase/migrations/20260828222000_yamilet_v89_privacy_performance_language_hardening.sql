drop policy if exists academy_integration_events_workspace_select on public.academy_integration_events;
create policy academy_integration_events_manager_select
on public.academy_integration_events
for select
to authenticated
using (
  private.current_user_is_platform_admin()
  or (
    workspace_id is not null
    and private.current_user_has_workspace_role(workspace_id, array['owner','admin'])
  )
);

create index if not exists academy_event_attendance_marked_by_idx
on public.academy_event_attendance(marked_by);

drop policy if exists certificate_registry_lookup_only on public.certificate_public_registry;
create policy certificate_registry_lookup_only
on public.certificate_public_registry
for select
using (
  verification_code = nullif((select current_setting('app.certificate_verification_code', true)), '')
);

create or replace function private.admin_change_academy_order_status_impl(target_order uuid, target_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare o public.orders%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Autenticación requerida'; end if;
  if target_status not in ('pending','approved','paid','refunded','cancelled') then raise exception 'Estado de compra no válido'; end if;
  select * into o from public.orders where id=target_order;
  if not found then raise exception 'Compra no encontrada'; end if;
  if not private.can_manage_academy_commerce(o.workspace_id) then raise exception 'Acceso denegado'; end if;
  if target_status in ('approved','paid') then
    if o.product_id is null or o.user_id is null then raise exception 'La compra necesita producto y estudiante antes de aprobarse'; end if;
    if coalesce(o.amount,0)<=0 then raise exception 'La compra necesita un importe mayor a 0'; end if;
  end if;
  update public.orders
  set status=target_status,
      approved_at=case when target_status in ('approved','paid') then coalesce(approved_at,now()) else approved_at end
  where id=target_order;
end;
$$;

create or replace function private.issue_academy_certificate_for_user(target_user uuid, target_course uuid)
returns table(certificate_id uuid, verification_code text, recipient_name text, course_title text, issued_at timestamp with time zone)
language plpgsql
security definer
set search_path to ''
as $$
declare c public.courses%rowtype; cert public.certificates%rowtype; elig record; display_name text; code text; cert_found boolean:=false; ws_slug text;
begin
  if target_user is null then raise exception 'Usuario requerido'; end if;
  select * into c from public.courses where id=target_course and status<>'archived';
  if not found then raise exception 'Curso no disponible'; end if;
  if not exists(select 1 from public.enrollments e where e.course_id=c.id and e.user_id=target_user and e.status in ('active','completed')) then raise exception 'El usuario no tiene acceso a este curso'; end if;
  select * into elig from private.certificate_eligibility_for_user(target_user,c.id);
  if not elig.eligible then raise exception 'Aún no cumple requisitos'; end if;
  perform pg_advisory_xact_lock(hashtext(target_user::text||':'||c.id::text));
  select * into cert from public.certificates where user_id=target_user and course_id=c.id and revoked_at is null order by issued_at desc limit 1;
  cert_found:=found;
  select coalesce(nullif(trim(p.full_name),''),nullif(trim(p.email),''),'Estudiante de la academia') into display_name from public.profiles p where p.id=target_user;
  display_name:=coalesce(display_name,'Estudiante de la academia');
  select w.slug into ws_slug from public.workspaces w where w.id=c.workspace_id;
  if not cert_found then
    loop
      code:=case when ws_slug='yamilet-mes' then 'AY-' else 'CA-' end||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
      exit when not exists(select 1 from public.certificates x where x.verification_code=code);
    end loop;
    insert into public.certificates(user_id,course_id,issued_at,verification_code,recipient_name,requirements_snapshot,revoked_at,updated_at)
    values(target_user,c.id,now(),code,display_name,jsonb_build_object('total_lessons',elig.total_lessons,'completed_lessons',elig.completed_lessons,'required_assessments',elig.required_assessments,'passed_assessments',elig.passed_assessments,'issued_under','academy-v89-hardening'),null,now())
    returning * into cert;
  end if;
  insert into public.certificate_public_registry(certificate_id,verification_code,recipient_name,course_title,issued_at,status,updated_at)
  values(cert.id,cert.verification_code,coalesce(cert.recipient_name,display_name),c.title,cert.issued_at,'valid',now())
  on conflict(certificate_id) do update set verification_code=excluded.verification_code,recipient_name=excluded.recipient_name,course_title=excluded.course_title,issued_at=excluded.issued_at,status=excluded.status,updated_at=now();
  return query select cert.id,cert.verification_code,coalesce(cert.recipient_name,display_name),c.title,cert.issued_at;
end;
$$;

create or replace function private.prepare_academy_community_author()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare p public.profiles%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Autenticación requerida'; end if;
  new.user_id := (select auth.uid());
  select * into p from public.profiles where id = (select auth.uid());
  new.author_name := coalesce(nullif(btrim(p.full_name),''), 'Estudiante');
  new.author_role := coalesce(nullif(p.role,''), 'student');
  return new;
end;
$$;

create or replace function private.set_academy_community_reply_author()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare uid uuid:=coalesce((select auth.uid()),new.user_id); workspace_value uuid; display_name text; workspace_role text;
begin
  if uid is null then raise exception 'Usuario requerido'; end if;
  new.user_id:=uid;
  select c.workspace_id into workspace_value from public.academy_community_threads t join public.courses c on c.id=t.course_id where t.id=new.thread_id;
  select coalesce(nullif(trim(p.full_name),''),nullif(trim(p.email),''),'Estudiante de Academia Yamilet') into display_name from public.profiles p where p.id=uid;
  select wm.role into workspace_role from public.workspace_members wm where wm.workspace_id=workspace_value and wm.user_id=uid and wm.status='active' limit 1;
  new.author_name:=coalesce(display_name,'Estudiante de Academia Yamilet');
  new.author_role:=coalesce(workspace_role,(select p.role from public.profiles p where p.id=uid),'student');
  return new;
end;
$$;

create or replace function private.set_academy_community_thread_author()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare uid uuid:=coalesce((select auth.uid()),new.user_id); workspace_value uuid; display_name text; workspace_role text;
begin
  if uid is null then raise exception 'Usuario requerido'; end if;
  new.user_id:=uid;
  select c.workspace_id into workspace_value from public.courses c where c.id=new.course_id;
  select coalesce(nullif(trim(p.full_name),''),nullif(trim(p.email),''),'Estudiante de Academia Yamilet') into display_name from public.profiles p where p.id=uid;
  select wm.role into workspace_role from public.workspace_members wm where wm.workspace_id=workspace_value and wm.user_id=uid and wm.status='active' limit 1;
  new.author_name:=coalesce(display_name,'Estudiante de Academia Yamilet');
  new.author_role:=coalesce(workspace_role,(select p.role from public.profiles p where p.id=uid),'student');
  return new;
end;
$$;
