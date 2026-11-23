-- Run after loading the company migration into pg_temp with cloned tables.
do $$
declare
  invoice_id uuid;
  rejected boolean := false;
begin
  invoice_id := pg_temp.create_company_invoice('Workshop Company', 'billing@example.com',
    '1 Example Road', 'Team workshop', current_date + 10, 750, 'PO-123');
  if not exists (select 1 from pg_temp.invoices where id=invoice_id and invoice_kind='Company'
      and amount=750 and booking_id is null and client_id is null and due_date is null
      and billing_address='1 Example Road' and purchase_order='PO-123' and status='Draft') then
    raise exception 'Company invoice draft details are incorrect';
  end if;
  update pg_temp.invoices set status='Sent' where id=invoice_id;
  if (select due_date from pg_temp.invoices where id=invoice_id) is not null then
    raise exception 'Company invoices must not gain a due date when sent';
  end if;
  perform pg_temp.mark_invoice_paid(invoice_id);
  if (select status from pg_temp.invoices where id=invoice_id) <> 'Paid' then
    raise exception 'Company invoice must be markable as paid without a booking';
  end if;
  if exists(select 1 from pg_temp.manual_payments) then
    raise exception 'Company payment must not create an individual therapy payment';
  end if;
  begin
    perform pg_temp.create_company_invoice('', null, null, 'Workshop', current_date, 50);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Blank company names must be rejected'; end if;
  rejected := false;
  begin
    perform pg_temp.create_company_invoice('Company', null, null, 'Workshop', current_date, 0);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Zero fees must be rejected'; end if;
end;
$$;
create or replace function pg_temp.is_current_user_admin() returns boolean language sql as $$select false$$;
do $$
declare rejected boolean := false;
begin
  begin
    perform pg_temp.create_company_invoice('Company', null, null, 'Workshop', current_date, 50);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Non-admin creation must be rejected'; end if;
end;
$$;
select 'Company invoice lifecycle and permission checks passed' as result;
