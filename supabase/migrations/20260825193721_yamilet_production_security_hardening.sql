-- Academia Yamilet · hardening de seguridad para producción
-- Mantiene las operaciones privilegiadas en private y expone wrappers SECURITY INVOKER.

create or replace function private.admin_record_academy_sale_impl(
  target_product uuid,
  target_user uuid,
  target_amount numeric default null,
  target_reference text default null,
  target_status text default 'paid'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.products%rowtype;
  oid uuid;
  final_amount numeric;
  payer text;
begin
  if (select auth.uid()) is null then raise exception 'Autenticación requerida'; end if;
  select * into p from public.products where id=target_product;
  if not found then raise exception 'Producto no encontrado'; end if;
  if not private.can_manage_academy_commerce(p.workspace_id) then raise exception 'Acceso denegado'; end if;
  if target_status not in ('pending','approved','paid') then raise exception 'Estado de compra no válido'; end if;
  if not exists(select 1 from auth.users u where u.id=target_user) then raise exception 'Usuario no encontrado'; end if;
  final_amount:=coalesce(target_amount,p.price,0);
  if target_status in ('approved','paid') and final_amount<=0 then raise exception 'Define un importe mayor a 0 para registrar una compra pagada'; end if;
  select pr.email into payer from public.profiles pr where pr.id=target_user;
  insert into public.orders(workspace_id,product_id,user_id,provider,external_reference,payer_email,amount,currency,status,approved_at)
  values(p.workspace_id,p.id,target_user,'manual',nullif(trim(target_reference),''),payer,final_amount,p.currency,target_status,case when target_status in ('approved','paid') then now() else null end)
  returning id into oid;
  return oid;
end;
$$;

create or replace function private.admin_change_academy_order_status_impl(target_order uuid,target_status text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare o public.orders%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Autenticación requerida'; end if;
  if target_status not in ('pending','approved','paid','refunded','cancelled') then raise exception 'Estado de compra no válido'; end if;
  select * into o from public.orders where id=target_order;
  if not found then raise exception 'Compra no encontrada'; end if;
  if not private.can_manage_academy_commerce(o.workspace_id) then raise exception 'Acceso denegado'; end if;
  if target_status in ('approved','paid') then
    if o.product_id is null or o.user_id is null then raise exception 'La compra necesita producto y alumna antes de aprobarse'; end if;
    if coalesce(o.amount,0)<=0 then raise exception 'La compra necesita un importe mayor a 0'; end if;
  end if;
  update public.orders
  set status=target_status,
      approved_at=case when target_status in ('approved','paid') then coalesce(approved_at,now()) else approved_at end
  where id=target_order;
end;
$$;

create or replace function public.admin_record_academy_sale(
  target_product uuid,
  target_user uuid,
  target_amount numeric default null,
  target_reference text default null,
  target_status text default 'paid'
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.admin_record_academy_sale_impl(target_product,target_user,target_amount,target_reference,target_status);
$$;

create or replace function public.admin_change_academy_order_status(target_order uuid,target_status text)
returns void
language sql
security invoker
set search_path=''
as $$
  select private.admin_change_academy_order_status_impl(target_order,target_status);
$$;

revoke execute on function public.admin_record_academy_sale(uuid,uuid,numeric,text,text) from public,anon;
revoke execute on function public.admin_change_academy_order_status(uuid,text) from public,anon;
grant execute on function public.admin_record_academy_sale(uuid,uuid,numeric,text,text) to authenticated,service_role;
grant execute on function public.admin_change_academy_order_status(uuid,text) to authenticated,service_role;
revoke execute on function private.admin_record_academy_sale_impl(uuid,uuid,numeric,text,text) from public,anon;
revoke execute on function private.admin_change_academy_order_status_impl(uuid,text) from public,anon;
grant execute on function private.admin_record_academy_sale_impl(uuid,uuid,numeric,text,text) to authenticated,service_role;
grant execute on function private.admin_change_academy_order_status_impl(uuid,text) to authenticated,service_role;

revoke all on table public.academy_integration_settings from public,anon,authenticated;
revoke all on table public.admin_rebuild_runs from public,anon,authenticated;
grant all on table public.academy_integration_settings to service_role;
grant all on table public.admin_rebuild_runs to service_role;

drop policy if exists academy_integration_settings_no_client_access on public.academy_integration_settings;
create policy academy_integration_settings_no_client_access
on public.academy_integration_settings
as restrictive for all to anon,authenticated
using(false) with check(false);

drop policy if exists admin_rebuild_runs_no_client_access on public.admin_rebuild_runs;
create policy admin_rebuild_runs_no_client_access
on public.admin_rebuild_runs
as restrictive for all to anon,authenticated
using(false) with check(false);
