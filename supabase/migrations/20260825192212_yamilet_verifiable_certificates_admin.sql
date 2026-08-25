alter table public.certificates add column if not exists revoked_by uuid null references auth.users(id) on delete set null;
alter table public.certificates add column if not exists revoked_reason text null;

revoke select on public.certificate_public_registry from anon, authenticated;
drop policy if exists certificate_registry_public_read on public.certificate_public_registry;
drop policy if exists certificate_registry_no_direct_read on public.certificate_public_registry;
create policy certificate_registry_no_direct_read on public.certificate_public_registry for select to anon,authenticated using (false);

create or replace function public.verify_academy_certificate(target_code text)
returns table(verification_code text,recipient_name text,course_title text,issued_at timestamptz,status text)
language sql stable security definer set search_path=''
as $$
  select r.verification_code,r.recipient_name,r.course_title,r.issued_at,r.status
  from public.certificate_public_registry r
  where r.verification_code=upper(trim(target_code))
  limit 1
$$;
revoke all on function public.verify_academy_certificate(text) from public;
grant execute on function public.verify_academy_certificate(text) to anon,authenticated;

create or replace function private.admin_set_academy_certificate_revoked_impl(target_certificate uuid,target_revoked boolean,target_reason text default null)
returns table(certificate_id uuid,verification_code text,status text,revoked_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  cert public.certificates%rowtype;
  ws uuid;
  allowed boolean:=false;
begin
  if uid is null then raise exception 'Autenticación requerida'; end if;
  select c.* into cert from public.certificates c where c.id=target_certificate;
  if not found then raise exception 'Certificado no encontrado'; end if;
  select cr.workspace_id into ws from public.courses cr where cr.id=cert.course_id;
  allowed:=exists(select 1 from public.workspace_members wm where wm.workspace_id=ws and wm.user_id=uid and wm.status='active' and wm.role in ('owner','admin'))
    or exists(select 1 from public.profiles p where p.id=uid and p.role='admin');
  if not allowed then raise exception 'No autorizado para modificar este certificado'; end if;
  if target_revoked then
    update public.certificates c
      set revoked_at=coalesce(c.revoked_at,now()),revoked_by=uid,revoked_reason=nullif(trim(coalesce(target_reason,'')),''),updated_at=now()
      where c.id=target_certificate returning c.* into cert;
    update public.certificate_public_registry r set status='revoked',updated_at=now() where r.certificate_id=target_certificate;
  else
    update public.certificates c
      set revoked_at=null,revoked_by=null,revoked_reason=null,updated_at=now()
      where c.id=target_certificate returning c.* into cert;
    update public.certificate_public_registry r set status='valid',updated_at=now() where r.certificate_id=target_certificate;
  end if;
  return query select cert.id,cert.verification_code,case when cert.revoked_at is null then 'valid'::text else 'revoked'::text end,cert.revoked_at;
end
$$;
revoke all on function private.admin_set_academy_certificate_revoked_impl(uuid,boolean,text) from public;
grant execute on function private.admin_set_academy_certificate_revoked_impl(uuid,boolean,text) to authenticated;

create or replace function public.admin_set_academy_certificate_revoked(target_certificate uuid,target_revoked boolean,target_reason text default null)
returns table(certificate_id uuid,verification_code text,status text,revoked_at timestamptz)
language sql security invoker set search_path=''
as $$ select * from private.admin_set_academy_certificate_revoked_impl(target_certificate,target_revoked,target_reason) $$;
revoke all on function public.admin_set_academy_certificate_revoked(uuid,boolean,text) from public;
grant execute on function public.admin_set_academy_certificate_revoked(uuid,boolean,text) to authenticated;