-- Yamilet Academy P0
-- Outbox desacoplado para integraciones futuras (por ejemplo Compás One).
-- La academia funciona aunque ningún consumidor externo esté conectado.

begin;

create table if not exists public.academy_outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  aggregate_type text,
  aggregate_id uuid,
  dedupe_key text unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'delivered', 'failed', 'ignored')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.academy_outbox_events enable row level security;

-- El navegador solo puede consultar eventos de su workspace; la creación y
-- procesamiento quedan reservados a funciones de servidor/service role.
revoke all on table public.academy_outbox_events from anon;
revoke all on table public.academy_outbox_events from authenticated;
grant select on table public.academy_outbox_events to authenticated;

create policy "academy_outbox_events_workspace_select"
on public.academy_outbox_events
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  or public.is_super_admin()
);

create index if not exists academy_outbox_events_status_created_idx
  on public.academy_outbox_events (status, created_at);

create index if not exists academy_outbox_events_workspace_created_idx
  on public.academy_outbox_events (workspace_id, created_at desc);

commit;