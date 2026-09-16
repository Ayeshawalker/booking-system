-- Keep unsent invoices aligned with their source booking and refuse to send
-- an invoice whose booking is no longer confirmed or has a different date.

create or replace function public.sync_draft_invoice_date_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.preferred_date is not distinct from old.preferred_date then
    return new;
  end if;

  update public.invoices
  set session_date = new.preferred_date,
      payment_reference = upper(to_char(new.preferred_date, 'DDMONYY'))
  where booking_id = new.id
    and status = 'Draft';

  return new;
end;
$$;

drop trigger if exists sync_draft_invoice_date_after_booking_move
on public.booking_requests;
create trigger sync_draft_invoice_date_after_booking_move
after update of preferred_date on public.booking_requests
for each row execute function public.sync_draft_invoice_date_from_booking();

create or replace function public.validate_invoice_before_send()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record public.booking_requests%rowtype;
begin
  if new.status <> 'Sent' or old.status = 'Sent' then
    return new;
  end if;

  select * into booking_record
  from public.booking_requests
  where id = new.booking_id;

  if booking_record.id is null then
    raise exception 'Invoice cannot be sent because its source booking is missing';
  end if;
  if booking_record.status <> 'confirmed' then
    raise exception 'Invoice cannot be sent because its source booking is not confirmed';
  end if;
  if new.session_date is distinct from booking_record.preferred_date then
    raise exception 'Invoice cannot be sent because its session date does not match the source booking';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_invoice_before_send on public.invoices;
create trigger validate_invoice_before_send
before update of status on public.invoices
for each row execute function public.validate_invoice_before_send();

revoke all on function public.sync_draft_invoice_date_from_booking() from public;
revoke all on function public.validate_invoice_before_send() from public;
