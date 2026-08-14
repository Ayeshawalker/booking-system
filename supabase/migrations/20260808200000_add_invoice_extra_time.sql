alter table public.invoices
add column if not exists session_duration text,
add column if not exists extra_minutes integer not null default 0 check (extra_minutes >= 0),
add column if not exists extra_amount numeric(10, 2) not null default 0 check (extra_amount >= 0);

update public.invoices as invoice
set session_duration = booking.duration::text
from public.booking_requests as booking
where invoice.booking_id = booking.id
  and invoice.session_duration is null;

create or replace function public.set_invoice_session_duration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.session_duration is null then
    select duration::text into new.session_duration
    from public.booking_requests
    where id = new.booking_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_session_duration on public.invoices;
create trigger set_invoice_session_duration
before insert on public.invoices
for each row execute function public.set_invoice_session_duration();
