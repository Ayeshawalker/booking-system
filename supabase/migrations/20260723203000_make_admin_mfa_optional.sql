drop policy if exists "MFA admin can read clients" on public.clients;
drop policy if exists "Approved admin can read clients" on public.clients;
create policy "Approved admin can read clients"
on public.clients
for select
to authenticated
using ((select public.is_current_user_admin()));

drop policy if exists "MFA admin can create clients" on public.clients;
drop policy if exists "Approved admin can create clients" on public.clients;
create policy "Approved admin can create clients"
on public.clients
for insert
to authenticated
with check (
  (select public.is_current_user_admin())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists "MFA admin can update clients" on public.clients;
drop policy if exists "Approved admin can update clients" on public.clients;
create policy "Approved admin can update clients"
on public.clients
for update
to authenticated
using ((select public.is_current_user_admin()))
with check ((select public.is_current_user_admin()));

drop policy if exists "MFA admin can delete clients" on public.clients;
drop policy if exists "Approved admin can delete clients" on public.clients;
create policy "Approved admin can delete clients"
on public.clients
for delete
to authenticated
using ((select public.is_current_user_admin()));

drop policy if exists "MFA admin can read client audit log"
on public.client_audit_log;
drop policy if exists "Approved admin can read client audit log"
on public.client_audit_log;
create policy "Approved admin can read client audit log"
on public.client_audit_log
for select
to authenticated
using ((select public.is_current_user_admin()));

drop policy if exists "MFA admin can manage unavailable dates"
on public.public_unavailable_dates;
drop policy if exists "Approved admin can manage unavailable dates"
on public.public_unavailable_dates;
create policy "Approved admin can manage unavailable dates"
on public.public_unavailable_dates
for all
to authenticated
using ((select public.is_current_user_admin()))
with check ((select public.is_current_user_admin()));

drop policy if exists "MFA admin can read in-person availability"
on public.in_person_availability;
drop policy if exists "Approved admin can read in-person availability"
on public.in_person_availability;
create policy "Approved admin can read in-person availability"
on public.in_person_availability
for select
to authenticated
using ((select public.is_current_user_admin()));

drop policy if exists "MFA admin can manage in-person availability"
on public.in_person_availability;
drop policy if exists "Approved admin can manage in-person availability"
on public.in_person_availability;
create policy "Approved admin can manage in-person availability"
on public.in_person_availability
for all
to authenticated
using ((select public.is_current_user_admin()))
with check ((select public.is_current_user_admin()));

drop policy if exists "MFA admin can create booking requests"
on public.booking_requests;
drop policy if exists "Approved admin can create booking requests"
on public.booking_requests;
create policy "Approved admin can create booking requests"
on public.booking_requests
for insert
to authenticated
with check ((select public.is_current_user_admin()));

drop policy if exists "MFA admin can read booking requests"
on public.booking_requests;
drop policy if exists "Approved admin can read booking requests"
on public.booking_requests;
create policy "Approved admin can read booking requests"
on public.booking_requests
for select
to authenticated
using ((select public.is_current_user_admin()));
