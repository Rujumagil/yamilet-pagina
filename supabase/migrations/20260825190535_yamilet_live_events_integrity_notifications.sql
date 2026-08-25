alter table public.academy_notifications
  drop constraint if exists academy_notifications_notification_type_check;

alter table public.academy_notifications
  add constraint academy_notifications_notification_type_check
  check (notification_type = any (array[
    'course_assigned'::text,
    'assessment_available'::text,
    'assessment_passed'::text,
    'assessment_failed'::text,
    'certificate_ready'::text,
    'inactivity'::text,
    'system'::text,
    'event_upcoming'::text,
    'event_updated'::text,
    'event_cancelled'::text
  ]));

create or replace function private.validate_academy_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := nullif(trim(new.title), '');
  new.description := nullif(trim(coalesce(new.description,'')), '');
  new.location_text := nullif(trim(coalesce(new.location_text,'')), '');
  new.meeting_url := nullif(trim(coalesce(new.meeting_url,'')), '');

  if new.title is null then
    raise exception 'El evento necesita un título';
  end if;

  if new.course_id is not null and not exists (
    select 1 from public.courses c
    where c.id = new.course_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'El curso seleccionado no pertenece a este workspace';
  end if;

  if new.status = 'published' then
    if new.delivery_mode in ('online','hybrid') and (new.meeting_url is null or new.meeting_url !~* '^https://') then
      raise exception 'Una sesión online o híbrida publicada necesita un enlace https válido';
    end if;
    if new.delivery_mode in ('in_person','hybrid') and new.location_text is null then
      raise exception 'Una sesión presencial o híbrida publicada necesita una ubicación';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists academy_events_validate on public.academy_events;
create trigger academy_events_validate
before insert or update on public.academy_events
for each row execute function private.validate_academy_event();

create or replace function private.notify_academy_event_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  notification_kind text;
  notification_title text;
  notification_body text;
  dedupe text;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    notification_kind := 'event_upcoming';
    notification_title := 'Nuevo evento en tu calendario';
    notification_body := new.title || ' fue agregado a tu calendario.';
    dedupe := 'event:' || new.id::text || ':published';
  elsif tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
    and (old.starts_at is distinct from new.starts_at
      or old.ends_at is distinct from new.ends_at
      or old.meeting_url is distinct from new.meeting_url
      or old.location_text is distinct from new.location_text
      or old.title is distinct from new.title) then
    notification_kind := 'event_updated';
    notification_title := 'Se actualizó una sesión';
    notification_body := new.title || ' tiene información nueva. Revisa fecha, horario o acceso.';
    dedupe := 'event:' || new.id::text || ':updated:' || floor(extract(epoch from new.updated_at))::bigint::text;
  elsif tg_op = 'UPDATE' and old.status = 'published' and new.status = 'cancelled' then
    notification_kind := 'event_cancelled';
    notification_title := 'Sesión cancelada';
    notification_body := new.title || ' fue cancelada. Revisa tu calendario para próximos eventos.';
    dedupe := 'event:' || new.id::text || ':cancelled';
  else
    return new;
  end if;

  for item in
    select distinct e.user_id
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where c.workspace_id = new.workspace_id
      and e.status in ('active','completed')
      and (new.course_id is null or e.course_id = new.course_id)
  loop
    perform private.enqueue_academy_notification(
      item.user_id,
      notification_kind,
      notification_title,
      notification_body,
      '#calendar',
      'event',
      new.id,
      dedupe
    );
  end loop;

  return new;
end;
$$;