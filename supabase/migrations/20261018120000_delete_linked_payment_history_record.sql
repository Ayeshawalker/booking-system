create or replace function public.delete_payment_history_record(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_source_reference text;
  linked_invoice_id uuid;
  deleted_count integer := 0;
begin
  if not public.is_current_user_admin() then
    raise exception 'Not authorised';
  end if;

  select source_reference
  into payment_source_reference
  from public.manual_payments
  where id = p_payment_id
  for update;

  if not found then
    return false;
  end if;

  if payment_source_reference ~* '^invoice:[0-9a-f-]{36}$' then
    linked_invoice_id := substring(payment_source_reference from 9)::uuid;
    update public.invoices
    set status = 'Cancelled'
    where id = linked_invoice_id;
  end if;

  delete from public.manual_payments
  where id = p_payment_id;
  get diagnostics deleted_count = row_count;

  return deleted_count = 1;
end;
$$;

revoke all on function public.delete_payment_history_record(uuid) from public;
grant execute on function public.delete_payment_history_record(uuid) to authenticated;
