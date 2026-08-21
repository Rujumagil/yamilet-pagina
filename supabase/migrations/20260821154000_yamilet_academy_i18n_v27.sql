-- Academia Yamilet v27 · Internacionalización ES/IT
-- Mantiene un solo curso/progreso y separa preferencia de idioma de las traducciones de contenido.

create table if not exists public.academy_user_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  locale text not null default 'es' check (locale in ('es','it')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create index if not exists academy_user_preferences_workspace_idx
  on public.academy_user_preferences(workspace_id);

alter table public.academy_user_preferences enable row level security;
grant select, insert, update on public.academy_user_preferences to authenticated;
revoke delete on public.academy_user_preferences from authenticated;

drop policy if exists academy_user_preferences_select_own on public.academy_user_preferences;
create policy academy_user_preferences_select_own
on public.academy_user_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists academy_user_preferences_insert_own on public.academy_user_preferences;
create policy academy_user_preferences_insert_own
on public.academy_user_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists academy_user_preferences_update_own on public.academy_user_preferences;
create policy academy_user_preferences_update_own
on public.academy_user_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.academy_content_translations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  entity_type text not null check (entity_type in ('course','module','lesson','assessment','question','option','resource','event','certificate','community')),
  entity_id uuid not null,
  locale text not null check (locale in ('es','it')),
  field_name text not null,
  source_text text,
  translated_text text,
  translated_html text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, locale, field_name)
);

create index if not exists academy_content_translations_course_locale_idx
  on public.academy_content_translations(course_id, locale, status);
create index if not exists academy_content_translations_entity_idx
  on public.academy_content_translations(entity_type, entity_id, locale);
create index if not exists academy_content_translations_created_by_idx
  on public.academy_content_translations(created_by);

alter table public.academy_content_translations enable row level security;
grant select, insert, update, delete on public.academy_content_translations to authenticated;

drop policy if exists academy_content_translations_select_scoped on public.academy_content_translations;
create policy academy_content_translations_select_scoped
on public.academy_content_translations for select
to authenticated
using (
  private.can_manage_academy_course(course_id)
  or (
    status = 'published'
    and exists (
      select 1 from public.enrollments e
      where e.course_id = academy_content_translations.course_id
        and e.user_id = (select auth.uid())
        and e.status in ('active','completed')
    )
  )
);

drop policy if exists academy_content_translations_insert_scoped on public.academy_content_translations;
create policy academy_content_translations_insert_scoped
on public.academy_content_translations for insert
to authenticated
with check (
  private.can_manage_academy_course(course_id)
  and created_by = (select auth.uid())
);

drop policy if exists academy_content_translations_update_scoped on public.academy_content_translations;
create policy academy_content_translations_update_scoped
on public.academy_content_translations for update
to authenticated
using (private.can_manage_academy_course(course_id))
with check (private.can_manage_academy_course(course_id));

drop policy if exists academy_content_translations_delete_scoped on public.academy_content_translations;
create policy academy_content_translations_delete_scoped
on public.academy_content_translations for delete
to authenticated
using (private.can_manage_academy_course(course_id));
