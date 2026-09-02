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
    new.due_date := new.invoice_date + coalesce(terms_days, 2);
  end if;
  return new;
end;
$$;
