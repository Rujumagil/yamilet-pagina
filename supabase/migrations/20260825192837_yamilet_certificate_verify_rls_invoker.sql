grant select on public.certificate_public_registry to anon,authenticated;
drop policy if exists certificate_registry_no_direct_read on public.certificate_public_registry;
drop policy if exists certificate_registry_lookup_only on public.certificate_public_registry;
create policy certificate_registry_lookup_only on public.certificate_public_registry for select to anon,authenticated using (verification_code = nullif(current_setting('app.certificate_verification_code',true),''));

create or replace function public.verify_academy_certificate(target_code text)
returns table(verification_code text,recipient_name text,course_title text,issued_at timestamptz,status text)
language plpgsql security invoker set search_path=''
as $$
declare clean_code text:=upper(trim(coalesce(target_code,'')));
begin
  if clean_code='' then return; end if;
  perform set_config('app.certificate_verification_code',clean_code,true);
  return query
    select r.verification_code,r.recipient_name,r.course_title,r.issued_at,r.status
    from public.certificate_public_registry r
    where r.verification_code=clean_code
    limit 1;
end
$$;
revoke all on function public.verify_academy_certificate(text) from public;
grant execute on function public.verify_academy_certificate(text) to anon,authenticated;