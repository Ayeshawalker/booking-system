create table if not exists public.manual_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null check (nullif(trim(client_name), '') is not null),
  session_date date not null,
  session_format text not null default 'Not recorded' check (
    session_format in ('Online', 'In person', 'Not recorded')
  ),
  session_type text not null default 'Individual' check (
    session_type in ('Individual', 'Couple')
  ),
  fee_due numeric(10, 2) not null default 0 check (fee_due >= 0),
  amount_received numeric(10, 2) not null default 0 check (amount_received >= 0),
  invoice_sent_date date,
  payment_date date,
  notes text,
  source text not null default 'Manual' check (
    source in ('Manual', 'Numbers import')
  ),
  source_reference text,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_reference)
);

alter table public.clients
add column if not exists payment_reviewed_at date;

alter table public.clients
add column if not exists bank_payment_name text;

create or replace function public.set_manual_payment_updated_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_manual_payment_updated_fields on public.manual_payments;
create trigger set_manual_payment_updated_fields
before update on public.manual_payments
for each row execute function public.set_manual_payment_updated_fields();

alter table public.manual_payments enable row level security;

revoke all on public.manual_payments from anon;
grant select, insert, update, delete on public.manual_payments to authenticated;

drop policy if exists "Approved admin can read manual payments" on public.manual_payments;
create policy "Approved admin can read manual payments"
on public.manual_payments for select
to authenticated
using (public.is_current_user_admin());

drop policy if exists "Approved admin can create manual payments" on public.manual_payments;
create policy "Approved admin can create manual payments"
on public.manual_payments for insert
to authenticated
with check (
  public.is_current_user_admin()
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists "Approved admin can update manual payments" on public.manual_payments;
create policy "Approved admin can update manual payments"
on public.manual_payments for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "Approved admin can delete manual payments" on public.manual_payments;
create policy "Approved admin can delete manual payments"
on public.manual_payments for delete
to authenticated
using (public.is_current_user_admin());

create index if not exists manual_payments_session_date_idx
on public.manual_payments(session_date desc);

create index if not exists manual_payments_client_name_idx
on public.manual_payments(lower(client_name));
