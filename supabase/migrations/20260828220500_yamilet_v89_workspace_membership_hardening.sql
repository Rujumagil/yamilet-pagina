create or replace function private.can_manage_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function private.guard_workspace_member_protection()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  uid uuid := (select auth.uid());
  trusted_server boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if trusted_server then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'owner' then
      raise exception 'El rol Propietario sólo puede asignarse desde una operación de servidor confiable' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then
      raise exception 'No se puede mover una membresía entre personas o academias' using errcode = '42501';
    end if;
    if uid is not null and old.user_id = uid then
      raise exception 'No puedes modificar tu propia membresía administrativa' using errcode = '42501';
    end if;
    if old.role = 'owner' then
      raise exception 'La membresía de un Propietario está protegida' using errcode = '42501';
    end if;
    if new.role = 'owner' then
      raise exception 'El rol Propietario sólo puede asignarse desde una operación de servidor confiable' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if uid is not null and old.user_id = uid then
      raise exception 'No puedes eliminar tu propia membresía administrativa' using errcode = '42501';
    end if;
    if old.role = 'owner' then
      raise exception 'La membresía de un Propietario está protegida' using errcode = '42501';
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists workspace_members_protection_v89 on public.workspace_members;
create trigger workspace_members_protection_v89
before insert or update or delete on public.workspace_members
for each row execute function private.guard_workspace_member_protection();
