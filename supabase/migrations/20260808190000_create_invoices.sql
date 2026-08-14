create extension if not exists supabase_vault with schema vault;

create sequence if not exists public.invoice_number_sequence start 1;

create table if not exists public.invoice_profile (
  profile_key text primary key default 'default' check (profile_key = 'default'),
  issuer_name text not null default 'Ayesha Jane',
  address_line_1 text not null default 'Suite 48, 275 New North Road',
  address_line_2 text,
  city_postcode text not null default 'London N1 7AA',
  payment_terms_days integer not null default 2 check (payment_terms_days between 0 and 90),
  invoice_prefix text not null default 'AJ' check (invoice_prefix ~ '^[A-Z0-9-]+$'),
  updated_at timestamptz not null default now()
);

insert into public.invoice_profile (
  profile_key, issuer_name, address_line_1, city_postcode,
  payment_terms_days, invoice_prefix
)
values (
  'default', 'Ayesha Jane', 'Suite 48, 275 New North Road', 'London N1 7AA',
  2, 'AJ'
)
on conflict (profile_key) do nothing;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.booking_requests(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text not null unique,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Paid', 'Cancelled')),
  invoice_date date not null default current_date,
  due_date date not null,
  session_date date not null,
  payment_reference text not null,
  client_name text not null,
  client_email text,
  client_phone text,
  description text not null,
  session_duration text,
  session_count integer not null default 1 check (session_count > 0),
  amount numeric(10, 2) not null check (amount >= 0),
  extra_minutes integer not null default 0 check (extra_minutes >= 0),
  extra_amount numeric(10, 2) not null default 0 check (extra_amount >= 0),
  booking_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_booking_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_record public.invoice_profile%rowtype;
  next_number bigint;
  generated_number text;
  generated_name text;
  generated_count integer;
  generated_description text;
begin
  if not coalesce(new.invoice_required, false)
     or coalesce(new.invoice_amount, 0) <= 0
     or exists (select 1 from public.invoices where booking_id = new.id) then
    return new;
  end if;

  select * into profile_record
  from public.invoice_profile
  where profile_key = 'default';

  next_number := nextval('public.invoice_number_sequence');
  generated_number := profile_record.invoice_prefix || lpad(next_number::text, 3, '0');
  generated_name := concat_ws(
    ' and ',
    nullif(trim(concat_ws(' ', new.first_name, new.surname)), ''),
    nullif(trim(concat_ws(' ', new.second_first_name, new.second_surname)), '')
  );
  generated_count := case
    when new.booking_type = 'Block booking' then greatest(
      coalesce(nullif(new.block_session_count::text, '')::integer, 1),
      1
    )
    else 1
  end;
  generated_description := case
    when new.booking_type = 'Block booking'
      then concat(new.session_format, ' block booking — ', generated_count, ' reserved sessions')
    else concat(new.session_format, ' ', lower(new.session_type), ' session')
  end;

  insert into public.invoices (
    booking_id, client_id, invoice_number, invoice_date, due_date,
    session_date, payment_reference, client_name, client_email, client_phone,
    description, session_duration, session_count, amount, booking_type
  )
  values (
    new.id, new.client_id, generated_number, current_date,
    current_date + profile_record.payment_terms_days,
    new.preferred_date, upper(to_char(new.preferred_date, 'DDMONYY')),
    generated_name, nullif(trim(new.email), ''), nullif(trim(new.phone), ''),
    generated_description, new.duration::text, generated_count, new.invoice_amount, new.booking_type
  );

  return new;
end;
$$;

drop trigger if exists create_invoice_after_booking on public.booking_requests;
create trigger create_invoice_after_booking
after insert or update of invoice_required, invoice_amount
on public.booking_requests
for each row execute function public.create_booking_invoice();

create or replace function public.set_invoice_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_invoice_updated_at on public.invoices;
create trigger set_invoice_updated_at
before update on public.invoices
for each row execute function public.set_invoice_updated_at();

create or replace function public.save_invoice_bank_details(
  account_name text,
  sort_code text,
  account_number text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  item record;
begin
  if not public.is_current_user_admin() then
    raise exception 'Not authorised';
  end if;

  for item in
    select * from (values
      ('invoice_bank_account_name', nullif(trim(account_name), '')),
      ('invoice_bank_sort_code', nullif(trim(sort_code), '')),
      ('invoice_bank_account_number', nullif(trim(account_number), ''))
    ) as values_to_save(secret_name, secret_value)
  loop
    if item.secret_value is not null then
      if exists (select 1 from vault.decrypted_secrets where name = item.secret_name) then
        perform vault.update_secret(
          (select id from vault.decrypted_secrets where name = item.secret_name limit 1),
          item.secret_value
        );
      else
        perform vault.create_secret(item.secret_value, item.secret_name, 'Ayesha Jane invoice payment detail');
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.get_invoice_bank_details()
returns table (account_name text, sort_code text, account_number text)
language sql
stable
security definer
set search_path = public, vault
as $$
  select
    max(decrypted_secret) filter (where name = 'invoice_bank_account_name'),
    max(decrypted_secret) filter (where name = 'invoice_bank_sort_code'),
    max(decrypted_secret) filter (where name = 'invoice_bank_account_number')
  from vault.decrypted_secrets
  where public.is_current_user_admin();
$$;

alter table public.invoice_profile enable row level security;
alter table public.invoices enable row level security;

revoke all on public.invoice_profile from anon;
revoke all on public.invoices from anon;
grant select, update on public.invoice_profile to authenticated;
grant select, update on public.invoices to authenticated;

drop policy if exists "Approved admin can read invoice profile" on public.invoice_profile;
create policy "Approved admin can read invoice profile"
on public.invoice_profile for select to authenticated
using (public.is_current_user_admin());

drop policy if exists "Approved admin can update invoice profile" on public.invoice_profile;
create policy "Approved admin can update invoice profile"
on public.invoice_profile for update to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "Approved admin can read invoices" on public.invoices;
create policy "Approved admin can read invoices"
on public.invoices for select to authenticated
using (public.is_current_user_admin());

drop policy if exists "Approved admin can update invoices" on public.invoices;
create policy "Approved admin can update invoices"
on public.invoices for update to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

revoke all on function public.save_invoice_bank_details(text, text, text) from public;
revoke all on function public.get_invoice_bank_details() from public;
grant execute on function public.save_invoice_bank_details(text, text, text) to authenticated;
grant execute on function public.get_invoice_bank_details() to authenticated;

create index if not exists invoices_invoice_date_idx on public.invoices(invoice_date desc);
create index if not exists invoices_client_id_idx on public.invoices(client_id, invoice_date desc);
