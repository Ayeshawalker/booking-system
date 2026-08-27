alter table public.invoices
add column if not exists replaced_by_invoice_id uuid
references public.invoices(id) on delete set null;

create index if not exists invoices_replaced_by_invoice_idx
on public.invoices(replaced_by_invoice_id)
where replaced_by_invoice_id is not null;

comment on column public.invoices.replaced_by_invoice_id is
  'Replacement invoice selected by the administrator. The old invoice is cancelled only when the replacement is sent.';

create or replace function public.set_invoice_replacements(
  p_replacement_invoice_id uuid,
  p_replaced_invoice_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  replacement_record public.invoices%rowtype;
  changed_count integer := 0;
begin
  if not public.is_current_user_admin() then
    raise exception 'Not authorised';
  end if;

  select * into replacement_record
  from public.invoices
  where id = p_replacement_invoice_id;

  if replacement_record.id is null then
    raise exception 'Replacement invoice not found';
  end if;

  if replacement_record.status in ('Paid', 'Cancelled') then
    raise exception 'A paid or cancelled invoice cannot replace another invoice';
  end if;

  -- If the draft is edited again, remove any earlier replacement choices that
  -- are no longer included. Sent invoices remain active until the replacement
  -- itself is sent.
  update public.invoices
  set replaced_by_invoice_id = null
  where replaced_by_invoice_id = replacement_record.id
    and status = 'Sent'
    and not (id = any(coalesce(p_replaced_invoice_ids, '{}'::uuid[])));

  update public.invoices old_invoice
  set
    replaced_by_invoice_id = replacement_record.id,
    status = case
      when replacement_record.status = 'Sent' then 'Cancelled'
      else old_invoice.status
    end
  where old_invoice.id = any(coalesce(p_replaced_invoice_ids, '{}'::uuid[]))
    and old_invoice.id <> replacement_record.id
    and old_invoice.status = 'Sent'
    and (
      old_invoice.client_id = replacement_record.client_id
      or (
        old_invoice.client_id is null
        and replacement_record.client_id is null
        and lower(trim(old_invoice.client_name)) = lower(trim(replacement_record.client_name))
      )
    );

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

create or replace function public.cancel_replaced_invoices_when_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Sent' and old.status is distinct from 'Sent' then
    update public.invoices
    set status = 'Cancelled'
    where replaced_by_invoice_id = new.id
      and status = 'Sent';
  end if;
  return new;
end;
$$;

drop trigger if exists cancel_replaced_invoices_on_send on public.invoices;
create trigger cancel_replaced_invoices_on_send
after update of status on public.invoices
for each row execute function public.cancel_replaced_invoices_when_sent();

revoke all on function public.set_invoice_replacements(uuid, uuid[]) from public;
grant execute on function public.set_invoice_replacements(uuid, uuid[]) to authenticated;
