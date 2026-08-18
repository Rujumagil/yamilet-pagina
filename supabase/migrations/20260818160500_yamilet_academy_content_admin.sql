-- Yamilet Academy P1.5 · Administrador de contenido
-- Objetivos:
-- 1. Añadir soporte persistente para media privada de lecciones y recursos asociados.
-- 2. Endurecer Storage por workspace/curso.
-- 3. Impedir publicar un curso vacío.
-- 4. Proveer RPC seguras para ordenar módulos y lecciones.
-- 5. No crear contenido ficticio ni borrar contenido existente.

alter table public.lessons
  add column if not exists media_path text,
  add column if not exists media_bucket text not null default 'lesson-media',
  add column if not exists media_mime_type text,
  add column if not exists media_filename text;

alter table public.resources
  add column if not exists description text,
  add column if not exists lesson_id uuid,
  add column if not exists position integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'resources_lesson_id_fkey'
      and conrelid = 'public.resources'::regclass
  ) then
    alter table public.resources
      add constraint resources_lesson_id_fkey
      foreign key (lesson_id) references public.lessons(id) on delete set null;
  end if;
end $$;

create index if not exists resources_course_position_idx
  on public.resources(course_id, position, created_at);
create index if not exists resources_lesson_id_idx
  on public.resources(lesson_id);
create index if not exists lessons_module_position_idx
  on public.lessons(module_id, position, created_at);
create index if not exists modules_course_position_idx
  on public.modules(course_id, position, created_at);

-- Publicación con guardia -------------------------------------------------------
create or replace function private.validate_academy_course_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from new.status then
    if not exists (
      select 1
      from public.modules m
      where m.course_id = new.id
    ) then
      raise exception 'No se puede publicar un curso sin módulos';
    end if;

    if not exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      where m.course_id = new.id
    ) then
      raise exception 'No se puede publicar un curso sin lecciones';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_academy_course_publication on public.courses;
create trigger validate_academy_course_publication
before update of status on public.courses
for each row execute function private.validate_academy_course_publication();

create or replace function public.set_academy_course_publication(target_course uuid, target_status text)
returns public.courses
language plpgsql
security definer
set search_path = ''
as $$
declare result public.courses%rowtype;
begin
  if target_status not in ('draft','published','archived') then
    raise exception 'Estado de curso no permitido';
  end if;
  if not private.can_manage_academy_course(target_course) then
    raise exception 'No autorizado para administrar este curso';
  end if;

  update public.courses
  set status = target_status, updated_at = now()
  where id = target_course
  returning * into result;

  if result.id is null then raise exception 'Curso no encontrado'; end if;
  return result;
end;
$$;

revoke all on function public.set_academy_course_publication(uuid,text) from public, anon;
grant execute on function public.set_academy_course_publication(uuid,text) to authenticated;

-- Ordenamiento atómico ---------------------------------------------------------
create or replace function public.reorder_academy_modules(target_course uuid, ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare item uuid; idx integer := 1; expected integer; supplied integer;
begin
  if not private.can_manage_academy_course(target_course) then
    raise exception 'No autorizado para administrar este curso';
  end if;
  select count(*) into expected from public.modules where course_id = target_course;
  supplied := coalesce(cardinality(ordered_ids),0);
  if expected <> supplied then raise exception 'La lista de módulos está incompleta'; end if;
  if exists (
    select 1 from unnest(ordered_ids) x(id)
    where not exists (select 1 from public.modules m where m.id=x.id and m.course_id=target_course)
  ) then raise exception 'La lista contiene módulos ajenos al curso'; end if;

  foreach item in array ordered_ids loop
    update public.modules set position = idx where id = item and course_id = target_course;
    idx := idx + 1;
  end loop;
end;
$$;

create or replace function public.reorder_academy_lessons(target_module uuid, ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare item uuid; idx integer := 1; target_course uuid; expected integer; supplied integer;
begin
  select course_id into target_course from public.modules where id = target_module;
  if target_course is null or not private.can_manage_academy_course(target_course) then
    raise exception 'No autorizado para administrar este módulo';
  end if;
  select count(*) into expected from public.lessons where module_id = target_module;
  supplied := coalesce(cardinality(ordered_ids),0);
  if expected <> supplied then raise exception 'La lista de lecciones está incompleta'; end if;
  if exists (
    select 1 from unnest(ordered_ids) x(id)
    where not exists (select 1 from public.lessons l where l.id=x.id and l.module_id=target_module)
  ) then raise exception 'La lista contiene lecciones ajenas al módulo'; end if;

  foreach item in array ordered_ids loop
    update public.lessons set position = idx, updated_at = now() where id = item and module_id = target_module;
    idx := idx + 1;
  end loop;
end;
$$;

revoke all on function public.reorder_academy_modules(uuid,uuid[]) from public, anon;
revoke all on function public.reorder_academy_lessons(uuid,uuid[]) from public, anon;
grant execute on function public.reorder_academy_modules(uuid,uuid[]) to authenticated;
grant execute on function public.reorder_academy_lessons(uuid,uuid[]) to authenticated;

-- Recursos por workspace/curso -------------------------------------------------
drop policy if exists resources_authorized_read on public.resources;
drop policy if exists resources_managers_insert on public.resources;
drop policy if exists resources_managers_update on public.resources;
drop policy if exists resources_managers_delete on public.resources;
drop policy if exists resources_read_scoped on public.resources;
drop policy if exists resources_insert_scoped on public.resources;
drop policy if exists resources_update_scoped on public.resources;
drop policy if exists resources_delete_scoped on public.resources;

create policy resources_read_scoped
on public.resources for select to authenticated
using (
  is_public
  or (course_id is not null and private.can_manage_academy_course(course_id))
  or (course_id is not null and exists (
    select 1 from public.enrollments e
    where e.course_id = resources.course_id
      and e.user_id = (select auth.uid())
      and e.status in ('active','completed')
  ))
);

create policy resources_insert_scoped
on public.resources for insert to authenticated
with check (
  course_id is not null
  and private.can_manage_academy_course(course_id)
  and exists (
    select 1 from public.courses c
    where c.id = resources.course_id
      and (resources.workspace_id is null or resources.workspace_id = c.workspace_id)
  )
);

create policy resources_update_scoped
on public.resources for update to authenticated
using (course_id is not null and private.can_manage_academy_course(course_id))
with check (
  course_id is not null
  and private.can_manage_academy_course(course_id)
  and exists (
    select 1 from public.courses c
    where c.id = resources.course_id
      and (resources.workspace_id is null or resources.workspace_id = c.workspace_id)
  )
);

create policy resources_delete_scoped
on public.resources for delete to authenticated
using (course_id is not null and private.can_manage_academy_course(course_id));

revoke all on public.resources from anon;
revoke truncate, trigger, references on public.resources from authenticated;
grant select, insert, update, delete on public.resources to authenticated;

-- Storage: portadas públicas, media privada y recursos privados ----------------
drop policy if exists course_media_managers_insert on storage.objects;
drop policy if exists course_media_managers_update on storage.objects;
drop policy if exists course_media_managers_delete on storage.objects;

create policy course_media_managers_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='course-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);

create policy course_media_managers_update
on storage.objects for update to authenticated
using (
  bucket_id='course-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id='course-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);

create policy course_media_managers_delete
on storage.objects for delete to authenticated
using (
  bucket_id='course-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);

drop policy if exists lesson_media_authorized_read on storage.objects;
drop policy if exists lesson_media_managers_insert on storage.objects;
drop policy if exists lesson_media_managers_update on storage.objects;
drop policy if exists lesson_media_managers_delete on storage.objects;

create policy lesson_media_authorized_read
on storage.objects for select to authenticated
using (
  bucket_id='lesson-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (
    private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
    or exists (
      select 1 from public.enrollments e
      where e.course_id=((storage.foldername(name))[2])::uuid
        and e.user_id=(select auth.uid())
        and e.status in ('active','completed')
    )
  )
);

create policy lesson_media_managers_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='lesson-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);

create policy lesson_media_managers_update
on storage.objects for update to authenticated
using (
  bucket_id='lesson-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id='lesson-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);

create policy lesson_media_managers_delete
on storage.objects for delete to authenticated
using (
  bucket_id='lesson-media'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);

drop policy if exists digital_products_authorized_read on storage.objects;
drop policy if exists digital_products_managers_insert on storage.objects;
drop policy if exists digital_products_managers_update on storage.objects;
drop policy if exists digital_products_managers_delete on storage.objects;

create policy digital_products_authorized_read
on storage.objects for select to authenticated
using (
  bucket_id='digital-products'
  and exists (
    select 1 from public.resources r
    where r.file_path = storage.objects.name
      and (
        r.is_public
        or (r.course_id is not null and private.can_manage_academy_course(r.course_id))
        or (r.course_id is not null and exists (
          select 1 from public.enrollments e
          where e.course_id=r.course_id
            and e.user_id=(select auth.uid())
            and e.status in ('active','completed')
        ))
      )
  )
);

create policy digital_products_managers_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='digital-products'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);

create policy digital_products_managers_update
on storage.objects for update to authenticated
using (
  bucket_id='digital-products'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id='digital-products'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);

create policy digital_products_managers_delete
on storage.objects for delete to authenticated
using (
  bucket_id='digital-products'
  and (storage.foldername(name))[1]='courses'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.can_manage_academy_course(((storage.foldername(name))[2])::uuid)
);
