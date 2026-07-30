alter table public.booking_requests
add column if not exists amount_received numeric(10, 2) not null default 0,
add column if not exists payment_date date;

alter table public.booking_requests
drop constraint if exists booking_requests_amount_received_check;

alter table public.booking_requests
add constraint booking_requests_amount_received_check
check (amount_received >= 0);

grant update on public.booking_requests to authenticated;

drop policy if exists "Approved admin can update booking payments"
on public.booking_requests;

create policy "Approved admin can update booking payments"
on public.booking_requests
for update
to authenticated
using ((select public.is_current_user_admin()))
with check ((select public.is_current_user_admin()));
