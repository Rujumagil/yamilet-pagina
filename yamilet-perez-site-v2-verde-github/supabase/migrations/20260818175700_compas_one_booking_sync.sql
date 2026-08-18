alter table public.free_class_bookings
  add column if not exists compas_one_contact_id uuid,
  add column if not exists compas_one_follow_up_id uuid,
  add column if not exists compas_one_synced_at timestamptz;

comment on column public.free_class_bookings.compas_one_contact_id is
  'ID del contacto correspondiente en Compás One; referencia externa, sin FK entre proyectos.';
comment on column public.free_class_bookings.compas_one_follow_up_id is
  'ID del seguimiento/agenda correspondiente en Compás One; referencia externa, sin FK entre proyectos.';
comment on column public.free_class_bookings.compas_one_synced_at is
  'Fecha de la última sincronización exitosa de esta reserva hacia Compás One.';

create table if not exists public.academy_integration_settings (
  provider text primary key,
  endpoint_url text not null,
  secret_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academy_integration_settings enable row level security;
revoke all on table public.academy_integration_settings from anon, authenticated;
grant select, insert, update, delete on table public.academy_integration_settings to service_role;

comment on table public.academy_integration_settings is
  'Configuración privada server-side para integraciones salientes de Academia Yamilet. No exponer al navegador.';

-- IMPORTANTE: no guardar la credencial compartida en GitHub.
-- La fila provider='compas_one' debe provisionarse únicamente en el entorno seguro de Supabase.