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

    new.due_date := current_date + coalesce(terms_days, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_due_date_on_send on public.invoices;
create trigger set_invoice_due_date_on_send
before update of status on public.invoices
for each row execute function public.set_invoice_due_date_when_sent();
