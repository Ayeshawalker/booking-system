create or replace function public.ensure_booking_invoice(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record public.booking_requests%rowtype;
  profile_record public.invoice_profile%rowtype;
  existing_invoice_id uuid;
  new_invoice_id uuid;
  generated_number text;
  generated_name text;
  generated_count integer;
  generated_description text;
  invoice_total numeric(10, 2);
begin
  select * into booking_record
  from public.booking_requests
  where id = p_booking_id;

  if booking_record.id is null
     or booking_record.booking_source <> 'Ayesha booking for client'
     or not coalesce(booking_record.invoice_required, false)
     or booking_record.status <> 'confirmed' then
    return null;
  end if;

  select id into existing_invoice_id
  from public.invoices
  where booking_id = p_booking_id;
  if existing_invoice_id is not null then
    return existing_invoice_id;
  end if;

  invoice_total := coalesce(
    nullif(booking_record.invoice_amount, 0),
    nullif(booking_record.total_cost, 0),
    nullif(booking_record.price, 0),
    0
  );
  if invoice_total <= 0 then return null; end if;

  select * into profile_record
  from public.invoice_profile
  where profile_key = 'default';

  generated_number := profile_record.invoice_prefix ||
    lpad(nextval('public.invoice_number_sequence')::text, 3, '0');
  generated_name := concat_ws(
    ' and ',
    nullif(trim(concat_ws(' ', booking_record.first_name, booking_record.surname)), ''),
    nullif(trim(concat_ws(' ', booking_record.second_first_name, booking_record.second_surname)), '')
  );
  generated_count := case
    when booking_record.booking_type = 'Block booking' then greatest(
      coalesce(nullif(booking_record.block_session_count::text, '')::integer, 1), 1
    )
    else 1
  end;
  generated_description := case
    when booking_record.booking_type = 'Block booking'
      then concat(booking_record.session_format, ' block booking — ', generated_count, ' reserved sessions')
    else concat(booking_record.session_format, ' ', lower(booking_record.session_type), ' session')
  end;

  insert into public.invoices (
    booking_id, client_id, invoice_number, invoice_date, due_date,
    session_date, payment_reference, client_name, client_email, client_phone,
    description, session_duration, session_count, amount, booking_type
  ) values (
    booking_record.id, booking_record.client_id, generated_number, current_date,
    current_date + profile_record.payment_terms_days,
    booking_record.preferred_date,
    upper(to_char(booking_record.preferred_date, 'DDMONYY')),
    generated_name, nullif(trim(booking_record.email), ''),
    nullif(trim(booking_record.phone), ''), generated_description,
    booking_record.duration::text, generated_count, invoice_total,
    booking_record.booking_type
  )
  returning id into new_invoice_id;

  return new_invoice_id;
end;
$$;

create or replace function public.create_booking_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.booking_source = 'Ayesha booking for client'
     and new.status = 'confirmed'
     and coalesce(new.invoice_required, false) then
    perform public.ensure_booking_invoice(new.id);
  end if;
  return new;
end;
$$;
