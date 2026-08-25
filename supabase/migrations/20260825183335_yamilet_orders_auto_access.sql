create or replace function private.normalize_academy_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status in ('approved','paid') and new.approved_at is null then
    new.approved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists academy_order_normalize on public.orders;
create trigger academy_order_normalize
before insert or update on public.orders
for each row execute function private.normalize_academy_order();

create or replace function private.sync_academy_order_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aid uuid;
  item record;
  other_paid integer := 0;
  ref text := 'order:' || new.id::text;
begin
  if new.product_id is null or new.user_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.products p
    where p.id = new.product_id and p.workspace_id = new.workspace_id
  ) then
    raise exception 'El producto no pertenece al workspace de la compra';
  end if;

  if new.status in ('approved','paid') then
    insert into public.student_access(
      user_id, product_id, status, source, reference, granted_by, granted_at, expires_at, updated_at
    ) values (
      new.user_id, new.product_id, 'active', 'purchase', ref, null, coalesce(new.approved_at, now()), null, now()
    )
    on conflict (user_id, product_id) do update
      set status = 'active',
          source = 'purchase',
          reference = excluded.reference,
          granted_by = null,
          granted_at = excluded.granted_at,
          expires_at = null,
          updated_at = now()
    returning id into aid;

    for item in
      select pc.*
      from public.product_contents pc
      where pc.product_id = new.product_id
    loop
      if item.content_type = 'course' and item.course_id is not null
         and exists (
           select 1 from public.courses c
           where c.id = item.course_id and c.workspace_id = new.workspace_id
         ) then
        insert into public.enrollments(user_id, course_id, status, enrolled_at)
        values (new.user_id, item.course_id, 'active', now())
        on conflict (user_id, course_id) do update
          set status = case when public.enrollments.status = 'completed' then 'completed' else 'active' end,
              completed_at = case when public.enrollments.status = 'completed' then public.enrollments.completed_at else null end;
      elsif item.content_type = 'resource' and item.resource_id is not null
         and exists (
           select 1 from public.resources r
           where r.id = item.resource_id and (r.workspace_id = new.workspace_id or r.workspace_id is null)
         ) then
        insert into public.resource_access(user_id, resource_id, product_id, status, granted_at, expires_at)
        values (new.user_id, item.resource_id, new.product_id, 'active', now(), null)
        on conflict (user_id, resource_id, product_id) do update
          set status = 'active', granted_at = now(), expires_at = null;
      end if;
    end loop;

    if not exists (
      select 1 from public.access_history h
      where h.user_id = new.user_id
        and h.product_id = new.product_id
        and h.action = 'purchase_granted'
        and h.reference = ref
    ) then
      insert into public.access_history(access_id,user_id,product_id,action,previous_status,new_status,reference,performed_by)
      values(aid,new.user_id,new.product_id,'purchase_granted',null,'active',ref,null);
    end if;

  elsif new.status in ('refunded','cancelled') then
    select count(*) into other_paid
    from public.orders o
    where o.user_id = new.user_id
      and o.product_id = new.product_id
      and o.id <> new.id
      and o.status in ('approved','paid');

    if other_paid = 0 then
      select sa.id into aid
      from public.student_access sa
      where sa.user_id = new.user_id
        and sa.product_id = new.product_id
        and sa.source = 'purchase'
      limit 1;

      if aid is not null then
        update public.student_access
        set status = 'revoked', updated_at = now()
        where id = aid;

        for item in
          select pc.*
          from public.product_contents pc
          where pc.product_id = new.product_id
        loop
          if item.content_type = 'course' and item.course_id is not null then
            update public.enrollments
            set status = 'cancelled'
            where user_id = new.user_id and course_id = item.course_id;
          elsif item.content_type = 'resource' and item.resource_id is not null then
            update public.resource_access
            set status = 'revoked'
            where user_id = new.user_id
              and resource_id = item.resource_id
              and product_id = new.product_id;
          end if;
        end loop;

        if not exists (
          select 1 from public.access_history h
          where h.user_id = new.user_id
            and h.product_id = new.product_id
            and h.action = 'purchase_revoked'
            and h.reference = ref
        ) then
          insert into public.access_history(access_id,user_id,product_id,action,previous_status,new_status,reference,performed_by)
          values(aid,new.user_id,new.product_id,'purchase_revoked','active','revoked',ref,null);
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists academy_order_access_sync on public.orders;
create trigger academy_order_access_sync
after insert or update of status, product_id, user_id, workspace_id on public.orders
for each row execute function private.sync_academy_order_access();
