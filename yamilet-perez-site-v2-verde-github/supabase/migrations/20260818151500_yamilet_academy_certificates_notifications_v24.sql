-- Academia Yamilet v24
-- Certificados automáticos, notificaciones de eventos y compatibilidad con inscripciones completed.

create or replace function private.certificate_eligibility_for_user(target_user uuid,target_course uuid)
returns table(total_lessons integer,completed_lessons integer,required_assessments integer,passed_assessments integer,eligible boolean)
language plpgsql security definer set search_path to '' as $$
begin
  select count(*)::integer into total_lessons from public.lessons l join public.modules m on m.id=l.module_id where m.course_id=target_course;
  select count(distinct lp.lesson_id)::integer into completed_lessons from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id join public.modules m on m.id=l.module_id where m.course_id=target_course and lp.user_id=target_user and lp.completed=true;
  select count(*)::integer into required_assessments from public.assessments a where a.course_id=target_course and a.status='published';
  select count(*)::integer into passed_assessments from public.assessments a where a.course_id=target_course and a.status='published' and exists(select 1 from public.assessment_attempts aa where aa.assessment_id=a.id and aa.user_id=target_user and aa.status='graded' and aa.passed=true);
  eligible:=total_lessons>0 and completed_lessons>=total_lessons and passed_assessments>=required_assessments;
  return next;
end;$$;

create or replace function private.certificate_eligibility_impl(target_course uuid)
returns table(total_lessons integer,completed_lessons integer,required_assessments integer,passed_assessments integer,eligible boolean)
language plpgsql security definer set search_path to '' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Autenticación requerida'; end if;
  if not exists(select 1 from public.enrollments e where e.course_id=target_course and e.user_id=uid and e.status in ('active','completed')) and not private.can_manage_course(target_course) then raise exception 'No tienes acceso a este curso'; end if;
  return query select * from private.certificate_eligibility_for_user(uid,target_course);
end;$$;

create or replace function private.issue_academy_certificate_for_user(target_user uuid,target_course uuid)
returns table(certificate_id uuid,verification_code text,recipient_name text,course_title text,issued_at timestamptz)
language plpgsql security definer set search_path to '' as $$
declare c public.courses%rowtype; cert public.certificates%rowtype; elig record; display_name text; code text; cert_found boolean:=false; ws_slug text;
begin
  if target_user is null then raise exception 'Usuario requerido'; end if;
  select * into c from public.courses where id=target_course and status<>'archived'; if not found then raise exception 'Curso no disponible'; end if;
  if not exists(select 1 from public.enrollments e where e.course_id=c.id and e.user_id=target_user and e.status in ('active','completed')) then raise exception 'El usuario no tiene acceso a este curso'; end if;
  select * into elig from private.certificate_eligibility_for_user(target_user,c.id); if not elig.eligible then raise exception 'Aún no cumple requisitos'; end if;
  perform pg_advisory_xact_lock(hashtext(target_user::text||':'||c.id::text));
  select * into cert from public.certificates where user_id=target_user and course_id=c.id and revoked_at is null order by issued_at desc limit 1; cert_found:=found;
  select coalesce(nullif(trim(p.full_name),''),nullif(trim(p.email),''),'Alumno de la academia') into display_name from public.profiles p where p.id=target_user; display_name:=coalesce(display_name,'Alumno de la academia');
  select w.slug into ws_slug from public.workspaces w where w.id=c.workspace_id;
  if not cert_found then
    loop code:=case when ws_slug='yamilet-mes' then 'AY-' else 'CA-' end||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)); exit when not exists(select 1 from public.certificates x where x.verification_code=code); end loop;
    insert into public.certificates(user_id,course_id,issued_at,verification_code,recipient_name,requirements_snapshot,revoked_at,updated_at)
    values(target_user,c.id,now(),code,display_name,jsonb_build_object('total_lessons',elig.total_lessons,'completed_lessons',elig.completed_lessons,'required_assessments',elig.required_assessments,'passed_assessments',elig.passed_assessments,'issued_under','academy-v24-auto'),null,now()) returning * into cert;
  end if;
  insert into public.certificate_public_registry(certificate_id,verification_code,recipient_name,course_title,issued_at,status,updated_at)
  values(cert.id,cert.verification_code,coalesce(cert.recipient_name,display_name),c.title,cert.issued_at,'valid',now())
  on conflict(certificate_id) do update set verification_code=excluded.verification_code,recipient_name=excluded.recipient_name,course_title=excluded.course_title,issued_at=excluded.issued_at,status=excluded.status,updated_at=now();
  return query select cert.id,cert.verification_code,coalesce(cert.recipient_name,display_name),c.title,cert.issued_at;
end;$$;

create or replace function private.issue_academy_certificate_impl(target_course uuid)
returns table(certificate_id uuid,verification_code text,recipient_name text,course_title text,issued_at timestamptz)
language plpgsql security definer set search_path to '' as $$
declare uid uuid:=auth.uid(); begin if uid is null then raise exception 'Autenticación requerida'; end if; return query select * from private.issue_academy_certificate_for_user(uid,target_course); end;$$;

create or replace function private.try_auto_issue_academy_certificate(target_user uuid,target_course uuid)
returns boolean language plpgsql security definer set search_path to '' as $$
declare elig record; cid uuid;
begin
  if target_user is null or target_course is null then return false; end if;
  if not exists(select 1 from public.enrollments e where e.user_id=target_user and e.course_id=target_course and e.status in ('active','completed')) then return false; end if;
  select * into elig from private.certificate_eligibility_for_user(target_user,target_course); if not coalesce(elig.eligible,false) then return false; end if;
  if exists(select 1 from public.certificates c where c.user_id=target_user and c.course_id=target_course and c.revoked_at is null) then return false; end if;
  select certificate_id into cid from private.issue_academy_certificate_for_user(target_user,target_course) limit 1; return cid is not null;
exception when others then return false; end;$$;

create or replace function private.auto_certificate_from_enrollment() returns trigger language plpgsql security definer set search_path to '' as $$
begin if new.status in ('active','completed') then perform private.try_auto_issue_academy_certificate(new.user_id,new.course_id); end if; return new; end;$$;
drop trigger if exists auto_certificate_from_enrollment on public.enrollments;
create trigger auto_certificate_from_enrollment after insert or update of status on public.enrollments for each row execute function private.auto_certificate_from_enrollment();

create or replace function private.auto_certificate_from_assessment() returns trigger language plpgsql security definer set search_path to '' as $$
declare cid uuid; begin if new.status='graded' and new.passed=true and new.graded_at is not null then select a.course_id into cid from public.assessments a where a.id=new.assessment_id; perform private.try_auto_issue_academy_certificate(new.user_id,cid); end if; return new; end;$$;
drop trigger if exists auto_certificate_from_assessment on public.assessment_attempts;
create trigger auto_certificate_from_assessment after insert or update of status,passed,graded_at on public.assessment_attempts for each row execute function private.auto_certificate_from_assessment();

create or replace function private.notify_academy_assessment_published() returns trigger language plpgsql security definer set search_path to '' as $$
declare enrollment_item record; begin if new.status='published' and (tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from new.status)) then for enrollment_item in select e.user_id from public.enrollments e where e.course_id=new.course_id and e.status in ('active','completed') loop perform private.enqueue_academy_notification(enrollment_item.user_id,'assessment_available','Nueva evaluación disponible',new.title||' ya está disponible dentro de tu curso.','#assessment/'||new.id::text,'assessment',new.id,'assessment:'||new.id::text||':published'); end loop; end if; return new; end;$$;

create or replace function private.notify_academy_event_published() returns trigger language plpgsql security definer set search_path to '' as $$
declare item record; begin if new.status='published' and (tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from new.status)) then for item in select distinct e.user_id from public.enrollments e join public.courses c on c.id=e.course_id where c.workspace_id=new.workspace_id and e.status in ('active','completed') and (new.course_id is null or e.course_id=new.course_id) loop perform private.enqueue_academy_notification(item.user_id,'event_upcoming','Nuevo evento en tu calendario',new.title||' fue agregado a tu calendario.','#calendar','event',new.id,'event:'||new.id::text||':published'); end loop; end if; return new; end;$$;
drop trigger if exists academy_event_published_notification on public.academy_events;
create trigger academy_event_published_notification after insert or update of status on public.academy_events for each row execute function private.notify_academy_event_published();

create or replace function private.refresh_academy_notifications_for_user(target_user uuid)
returns integer language plpgsql security definer set search_path to '' as $$
declare enrollment_item record; assessment_item record; certificate_item record; inactivity_item record; event_item record; inserted_count integer:=0; was_inserted boolean; last_activity timestamptz; iso_week text:=to_char(now(),'IYYY-IW');
begin
  if target_user is null or target_user<>auth.uid() then raise exception 'No autorizado'; end if;
  for enrollment_item in select e.id enrollment_id,e.course_id,e.enrolled_at,c.title course_title,c.workspace_id,w.name workspace_name from public.enrollments e join public.courses c on c.id=e.course_id left join public.workspaces w on w.id=c.workspace_id where e.user_id=target_user and e.status in ('active','completed') loop
    select private.enqueue_academy_notification(target_user,'course_assigned','Curso disponible en tu ruta',enrollment_item.course_title||' está disponible en '||coalesce(enrollment_item.workspace_name,'tu academia')||'.','#course/'||enrollment_item.course_id::text,'course',enrollment_item.course_id,'enrollment:'||enrollment_item.enrollment_id::text||':active') into was_inserted; if was_inserted then inserted_count:=inserted_count+1; end if;
    for assessment_item in select a.id assessment_id,a.title assessment_title,a.course_id from public.assessments a where a.course_id=enrollment_item.course_id and a.status='published' loop select private.enqueue_academy_notification(target_user,'assessment_available','Evaluación disponible',assessment_item.assessment_title||' está lista para responder.','#assessment/'||assessment_item.assessment_id::text,'assessment',assessment_item.assessment_id,'assessment:'||assessment_item.assessment_id::text||':published') into was_inserted; if was_inserted then inserted_count:=inserted_count+1; end if; end loop;
    for event_item in select ev.id,ev.title,ev.starts_at from public.academy_events ev where ev.workspace_id=enrollment_item.workspace_id and ev.status='published' and ev.starts_at>=now() and (ev.course_id is null or ev.course_id=enrollment_item.course_id) loop select private.enqueue_academy_notification(target_user,'event_upcoming','Próximo evento',event_item.title||' está programado en tu calendario.','#calendar','event',event_item.id,'event:'||event_item.id::text||':published') into was_inserted; if was_inserted then inserted_count:=inserted_count+1; end if; end loop;
  end loop;
  for certificate_item in select cert.id certificate_id,cert.course_id,c.title course_title from public.certificates cert join public.courses c on c.id=cert.course_id where cert.user_id=target_user and cert.revoked_at is null loop select private.enqueue_academy_notification(target_user,'certificate_ready','Tu certificado está listo','Ya puedes validar tu certificado de '||certificate_item.course_title||'.','#certificate/'||certificate_item.course_id::text,'certificate',certificate_item.certificate_id,'certificate:'||certificate_item.certificate_id::text||':ready') into was_inserted; if was_inserted then inserted_count:=inserted_count+1; end if; end loop;
  for inactivity_item in select e.id enrollment_id,e.course_id,e.enrolled_at,c.title course_title from public.enrollments e join public.courses c on c.id=e.course_id where e.user_id=target_user and e.status='active' and exists(select 1 from public.modules m join public.lessons l on l.module_id=m.id where m.course_id=e.course_id and not exists(select 1 from public.lesson_progress lp where lp.lesson_id=l.id and lp.user_id=target_user and lp.completed=true)) loop select greatest(inactivity_item.enrolled_at,coalesce((select max(lp.updated_at) from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id join public.modules m on m.id=l.module_id where lp.user_id=target_user and m.course_id=inactivity_item.course_id),inactivity_item.enrolled_at)) into last_activity; if last_activity < now()-interval '7 days' then select private.enqueue_academy_notification(target_user,'inactivity','Retoma tu ruta de aprendizaje','Han pasado varios días desde tu última actividad en '||inactivity_item.course_title||'.','#course/'||inactivity_item.course_id::text,'course',inactivity_item.course_id,'inactivity:'||inactivity_item.enrollment_id::text||':'||iso_week) into was_inserted; if was_inserted then inserted_count:=inserted_count+1; end if; end if; end loop;
  return inserted_count;
end;$$;
