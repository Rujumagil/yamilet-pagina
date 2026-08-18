create table if not exists public.academy_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid null references public.courses(id) on delete set null,
  title text not null,
  description text null,
  event_type text not null default 'session' check (event_type in ('session','workshop','live_class','orientation','webinar','community')),
  starts_at timestamptz not null,
  ends_at timestamptz null,
  timezone text not null default 'America/Mexico_City',
  delivery_mode text not null default 'online' check (delivery_mode in ('online','in_person','hybrid')),
  location_text text null,
  meeting_url text null,
  status text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
  is_featured boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_events_end_after_start check (ends_at is null or ends_at > starts_at)
);

create index if not exists academy_events_workspace_starts_idx on public.academy_events(workspace_id, starts_at);
create index if not exists academy_events_course_idx on public.academy_events(course_id) where course_id is not null;
create index if not exists academy_events_status_idx on public.academy_events(workspace_id, status, starts_at);

alter table public.academy_events enable row level security;
revoke all on public.academy_events from anon;
grant select, insert, update, delete on public.academy_events to authenticated;

create policy academy_events_select_scoped on public.academy_events
for select to authenticated
using (
  private.current_user_has_workspace_role(workspace_id, array['owner','admin','instructor']::text[])
  or (status = 'published' and private.current_user_is_workspace_member(workspace_id))
);

create policy academy_events_insert_staff on public.academy_events
for insert to authenticated
with check (
  private.current_user_has_workspace_role(workspace_id, array['owner','admin','instructor']::text[])
  and (created_by is null or created_by = (select auth.uid()))
);

create policy academy_events_update_staff on public.academy_events
for update to authenticated
using (private.current_user_has_workspace_role(workspace_id, array['owner','admin','instructor']::text[]))
with check (private.current_user_has_workspace_role(workspace_id, array['owner','admin','instructor']::text[]));

create policy academy_events_delete_staff on public.academy_events
for delete to authenticated
using (private.current_user_has_workspace_role(workspace_id, array['owner','admin','instructor']::text[]));

drop trigger if exists academy_events_set_updated_at on public.academy_events;
create trigger academy_events_set_updated_at
before update on public.academy_events
for each row execute function public.set_updated_at();
