-- Standalone workshop invoices do not create therapy bookings.
alter table public.invoices
  alter column booking_id drop not null,
  alter column due_date drop not null,
  add column invoice_kind text not null default 'Session' check (invoice_kind in ('Session', 'Company')),
  add column billing_address text,
  add column purchase_order text;

create or replace function public.create_company_invoice(
  p_company_name text, p_email text, p_billing_address text,
  p_description text, p_workshop_date date, p_amount numeric,
  p_purchase_order text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  result uuid;
  number text;
begin
  if not public.is_current_user_admin() then raise exception 'Not authorised'; end if;
  if nullif(trim(p_company_name), '') is null or nullif(trim(p_description), '') is null
     or p_workshop_date is null or p_amount is null or p_amount <= 0
     or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Enter a company, workshop description, date and positive fee';
  end if;
  select invoice_prefix || lpad(nextval('public.invoice_number_sequence')::text, 3, '0')
  into number from public.invoice_profile where profile_key = 'default';
  insert into public.invoices (
    invoice_kind, invoice_number, payment_reference, client_name, client_email,
    billing_address, purchase_order, description, session_date, amount, booking_type, due_date
  ) values (
    'Company', number, number, trim(p_company_name), nullif(trim(p_email), ''),
    nullif(trim(p_billing_address), ''), nullif(trim(p_purchase_order), ''),
    trim(p_description), p_workshop_date, p_amount, 'Workshop', null
  ) returning id into result;
  return result;
end;
$$;
revoke all on function public.create_company_invoice(text,text,text,text,date,numeric,text) from public;
grant execute on function public.create_company_invoice(text,text,text,text,date,numeric,text) to authenticated;

create or replace function public.set_invoice_due_date_when_sent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  terms_days integer;
begin
  if new.status = 'Sent' and old.status is distinct from 'Sent' then
    select payment_terms_days into terms_days
    from public.invoice_profile
    where profile_key = 'default';

    -- The invoice date is the date the finished invoice is sent, rather than
    -- the earlier date on which its draft was automatically created.
    if new.invoice_date is not distinct from old.invoice_date then
      new.invoice_date := current_date;
    end if;
    new.due_date := case when new.invoice_kind = 'Company' then null
      else new.invoice_date + coalesce(terms_days, 2) end;
  end if;
  return new;
end;
$$;

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

  if new.invoice_kind = 'Company' and new.booking_id is null then
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


create or replace function public.mark_invoice_paid(
  p_invoice_id uuid,
  p_payment_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_record public.invoices%rowtype;
  covered_dates date[];
  updated_payment_count integer := 0;
begin
  if not public.is_current_user_admin() then
    raise exception 'Not authorised';
  end if;

  select * into invoice_record
  from public.invoices
  where id = p_invoice_id
  for update;

  if invoice_record.id is null then
    raise exception 'Invoice not found';
  end if;
  if invoice_record.status <> 'Sent' then
    raise exception 'Only a sent and unpaid invoice can be marked paid';
  end if;

  if invoice_record.invoice_kind = 'Company' then
    update public.invoices set status = 'Paid' where id = p_invoice_id;
    return;
  end if;

  select coalesce(array_agg(distinct matched_date), array[invoice_record.session_date])
  into covered_dates
  from (
    select match[1]::date as matched_date
    from regexp_matches(
      coalesce(invoice_record.description, ''),
      '(20[0-9]{2}-[0-9]{2}-[0-9]{2})',
      'g'
    ) as found(match)
  ) dates;

  update public.manual_payments
  set
    amount_received = fee_due,
    payment_date = coalesce(p_payment_date, current_date),
    invoice_sent_date = coalesce(invoice_sent_date, invoice_record.invoice_date)
  where source_reference = 'invoice:' || invoice_record.id::text;

  update public.manual_payments
  set
    amount_received = fee_due,
    payment_date = coalesce(p_payment_date, current_date),
    invoice_sent_date = coalesce(invoice_sent_date, invoice_record.invoice_date)
  where session_date = any(covered_dates)
    and (
      (invoice_record.client_id is not null and client_id = invoice_record.client_id)
      or (
        invoice_record.client_id is null
        and lower(trim(client_name)) = lower(trim(invoice_record.client_name))
      )
    );

  get diagnostics updated_payment_count = row_count;

  if updated_payment_count = 0 and not exists (
    select 1 from public.manual_payments
    where source_reference = 'invoice:' || invoice_record.id::text
  ) then
    insert into public.manual_payments (
      client_id, client_name, session_date, session_type, session_format,
      fee_due, amount_received, invoice_sent_date, payment_date, notes,
      source, source_reference
    ) values (
      invoice_record.client_id,
      invoice_record.client_name,
      invoice_record.session_date,
      case when lower(invoice_record.description) ~ '(joint|couple)' then 'Couple' else 'Individual' end,
      case
        when lower(invoice_record.description) like 'in person%' then 'In person'
        when lower(invoice_record.description) like 'online%' then 'Online'
        else 'Not recorded'
      end,
      invoice_record.amount + coalesce(invoice_record.extra_amount, 0),
      invoice_record.amount + coalesce(invoice_record.extra_amount, 0),
      invoice_record.invoice_date,
      coalesce(p_payment_date, current_date),
      'Payment recorded from invoice ' || invoice_record.invoice_number || '.',
      'Manual',
      'invoice:' || invoice_record.id::text
    );
  end if;

  update public.invoices
  set status = 'Paid'
  where id = invoice_record.id;
end;
$$;

revoke all on function public.mark_invoice_paid(uuid, date) from public;
grant execute on function public.mark_invoice_paid(uuid, date) to authenticated;

