alter table public.booking_requests
add column if not exists client_id uuid
references public.clients(id)
on delete set null;

alter table public.booking_requests
alter column price type numeric(10, 2) using price::numeric,
alter column total_cost type numeric(10, 2) using total_cost::numeric,
alter column pay_now_amount type numeric(10, 2) using pay_now_amount::numeric,
alter column remaining_balance type numeric(10, 2) using remaining_balance::numeric,
alter column invoice_amount type numeric(10, 2) using invoice_amount::numeric,
alter column next_payment_due_amount type numeric(10, 2)
using next_payment_due_amount::numeric;

drop policy if exists "Allow public booking request inserts"
on public.booking_requests;

create policy "Allow public booking request inserts"
on public.booking_requests
for insert
to anon
with check (
  client_id is null
  and booking_source = 'Client booking'
);

create index if not exists booking_requests_client_id_idx
on public.booking_requests(client_id, preferred_date desc);
