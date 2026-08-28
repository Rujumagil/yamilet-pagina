drop policy if exists academy_event_attendance_no_direct_access on public.academy_event_attendance;
create policy academy_event_attendance_no_direct_access
on public.academy_event_attendance
for all
to authenticated
using (false)
with check (false);