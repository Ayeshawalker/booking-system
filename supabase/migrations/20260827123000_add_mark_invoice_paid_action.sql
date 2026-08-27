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
