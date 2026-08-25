-- Academia Yamilet · consolidación RLS e índices seguros para producción

create index if not exists academy_student_invites_invited_by_idx
  on public.academy_student_invites(invited_by) where invited_by is not null;
create index if not exists academy_student_invites_user_id_idx
  on public.academy_student_invites(user_id) where user_id is not null;
create index if not exists academy_support_messages_user_id_idx
  on public.academy_support_messages(user_id) where user_id is not null;
create index if not exists academy_support_tickets_course_id_idx
  on public.academy_support_tickets(course_id) where course_id is not null;
create index if not exists certificates_revoked_by_idx
  on public.certificates(revoked_by) where revoked_by is not null;

drop policy if exists certificate_registry_lookup_only on public.certificate_public_registry;
create policy certificate_registry_lookup_only
on public.certificate_public_registry
for select to anon,authenticated
using (
  verification_code = (select nullif(current_setting('app.certificate_verification_code', true),''))
);

-- Elimina políticas globales antiguas y conserva el aislamiento por workspace.
drop policy if exists "admin products" on public.products;
drop policy if exists "admin product contents" on public.product_contents;
drop policy if exists "admin orders" on public.orders;
drop policy if exists "admin access history" on public.access_history;

drop policy if exists certificates_owner_read on public.certificates;
drop policy if exists certificates_select_workspace_staff on public.certificates;
create policy certificates_select_scoped
on public.certificates
for select to authenticated
using (
  user_id=(select auth.uid())
  or private.current_user_can_manage_course(course_id)
);

drop policy if exists student_access_select on public.student_access;
drop policy if exists student_access_select_workspace_staff on public.student_access;
drop policy if exists student_access_admin_insert on public.student_access;
drop policy if exists student_access_admin_update on public.student_access;
drop policy if exists student_access_admin_delete on public.student_access;
create policy student_access_select_scoped
on public.student_access
for select to authenticated
using (
  user_id=(select auth.uid())
  or exists (
    select 1
    from public.products p
    where p.id=student_access.product_id
      and private.can_manage_academy_commerce(p.workspace_id)
  )
);

-- Compras, accesos y auditoría solo se escriben mediante RPCs privados validados.
revoke insert,update,delete on table public.orders from authenticated;
grant select on table public.orders to authenticated;
revoke insert,update,delete on table public.student_access from authenticated;
grant select on table public.student_access to authenticated;
revoke insert,update,delete on table public.access_history from authenticated;
grant select on table public.access_history to authenticated;
