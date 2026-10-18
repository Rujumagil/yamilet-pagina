begin;

alter table public.contacts
  add column if not exists compas_one_contact_id uuid,
  add column if not exists fly_stage text,
  add column if not exists fly_lead_score smallint,
  add column if not exists fly_lead_temperature text,
  add column if not exists fly_last_intent text,
  add column if not exists fly_service_interest text,
  add column if not exists fly_need text,
  add column if not exists fly_next_action text,
  add column if not exists fly_summary text,
  add column if not exists fly_last_analyzed_at timestamptz,
  add column if not exists fly_conversation_id uuid,
  add column if not exists fly_last_conversation_at timestamptz,
  add column if not exists fly_last_message_preview text,
  add column if not exists fly_follow_up_id uuid,
  add column if not exists fly_follow_up_title text,
  add column if not exists fly_follow_up_status text,
  add column if not exists fly_follow_up_at timestamptz,
  add column if not exists fly_synced_at timestamptz;

create unique index if not exists contacts_workspace_compas_one_contact_uidx
  on public.contacts(workspace_id,compas_one_contact_id)
  where compas_one_contact_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.contacts'::regclass
      and conname='contacts_fly_lead_temperature_check'
  ) then
    alter table public.contacts
      add constraint contacts_fly_lead_temperature_check
      check (fly_lead_temperature is null or fly_lead_temperature in ('cold','warm','hot'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.contacts'::regclass
      and conname='contacts_fly_lead_score_check'
  ) then
    alter table public.contacts
      add constraint contacts_fly_lead_score_check
      check (fly_lead_score is null or (fly_lead_score between 0 and 100));
  end if;
end $$;

comment on column public.contacts.compas_one_contact_id is
  'ID externo del contacto en Compás One / Fly.';
comment on column public.contacts.fly_stage is
  'Etapa comercial calculada por Compás Fly.';
comment on column public.contacts.fly_next_action is
  'Siguiente acción sugerida por Compás Fly.';
comment on column public.contacts.fly_summary is
  'Resumen comercial generado por Compás Fly.';
comment on column public.contacts.fly_synced_at is
  'Última sincronización desde Compás One.';

commit;
