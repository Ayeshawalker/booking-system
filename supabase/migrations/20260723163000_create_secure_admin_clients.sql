create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default 'Ayesha',
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (
    record_type in ('Individual', 'Couple')
  ),
  status text not null default 'Active' check (
    status in ('Prospective', 'Active', 'Paused', 'Former')
  ),
  first_name text not null,
  surname text not null,
  email text,
  phone text,
  second_first_name text,
  second_surname text,
  second_email text,
  second_phone text,
  contract_status text not null default 'Not sent' check (
    contract_status in ('Not sent', 'Sent', 'Signed', 'Not required')
  ),
  contract_signed_date date,
  intake_status text not null default 'Not sent' check (
    intake_status in ('Not sent', 'Sent', 'Completed', 'Not required')
  ),
  intake_completed_date date,
  specialities text[] not null default '{}',
  speciality_other text,
  session_frequency text not null default 'To be agreed' check (
    session_frequency in (
      'Weekly',
      'Fortnightly',
      'Monthly',
      'Flexible',
      'To be agreed',
      'Other'
    )
  ),
  frequency_notes text,
  preferred_format text not null default 'Either' check (
    preferred_format in ('Online', 'In person', 'Either')
  ),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    record_type = 'Individual'
    or (
      nullif(trim(second_first_name), '') is not null
      and nullif(trim(second_surname), '') is not null
    )
  )
);

create table if not exists public.client_audit_log (
  id bigint generated always as identity primary key,
  client_id uuid,
  action text not null check (action in ('created', 'updated', 'deleted')),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  record_snapshot jsonb not null
);

create table if not exists public.public_unavailable_dates (
  unavailable_date date primary key,
  note text,
  updated_at timestamptz not null default now()
);

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

create or replace function public.set_client_updated_fields()
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

create or replace function public.audit_client_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_audit_log (
    client_id,
    action,
    changed_by,
    record_snapshot
  )
  values (
    coalesce(new.id, old.id),
    case
      when tg_op = 'INSERT' then 'created'
      when tg_op = 'UPDATE' then 'updated'
      else 'deleted'
    end,
    auth.uid(),
    case
      when tg_op = 'DELETE' then to_jsonb(old)
      else to_jsonb(new)
    end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists set_client_updated_fields on public.clients;
create trigger set_client_updated_fields
before update on public.clients
for each row execute function public.set_client_updated_fields();

drop trigger if exists audit_client_change on public.clients;
create trigger audit_client_change
after insert or update or delete on public.clients
for each row execute function public.audit_client_change();

alter table public.admin_users enable row level security;
alter table public.clients enable row level security;
alter table public.client_audit_log enable row level security;
alter table public.public_unavailable_dates enable row level security;

revoke all on public.admin_users from anon;
revoke all on public.clients from anon;
revoke all on public.client_audit_log from anon;

grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select on public.client_audit_log to authenticated;
grant select on public.public_unavailable_dates to anon;
grant select, insert, update, delete on public.public_unavailable_dates to authenticated;
grant select on public.in_person_availability to anon;
grant select, insert, update, delete on public.in_person_availability to authenticated;
grant select, insert on public.booking_requests to authenticated;

drop policy if exists "Admin can read own membership" on public.admin_users;
create policy "Admin can read own membership"
on public.admin_users
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "MFA admin can read clients" on public.clients;
create policy "MFA admin can read clients"
on public.clients
for select
to authenticated
using (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

drop policy if exists "MFA admin can create clients" on public.clients;
create policy "MFA admin can create clients"
on public.clients
for insert
to authenticated
with check (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists "MFA admin can update clients" on public.clients;
create policy "MFA admin can update clients"
on public.clients
for update
to authenticated
using (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
)
with check (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

drop policy if exists "MFA admin can delete clients" on public.clients;
create policy "MFA admin can delete clients"
on public.clients
for delete
to authenticated
using (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

drop policy if exists "MFA admin can read client audit log" on public.client_audit_log;
create policy "MFA admin can read client audit log"
on public.client_audit_log
for select
to authenticated
using (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

drop policy if exists "Allow public unavailable date reads" on public.public_unavailable_dates;
create policy "Allow public unavailable date reads"
on public.public_unavailable_dates
for select
to anon
using (true);

drop policy if exists "Allow Ayesha page unavailable date inserts"
on public.public_unavailable_dates;
drop policy if exists "Allow Ayesha page unavailable date updates"
on public.public_unavailable_dates;
drop policy if exists "Allow Ayesha page unavailable date deletes"
on public.public_unavailable_dates;

drop policy if exists "MFA admin can manage unavailable dates" on public.public_unavailable_dates;
create policy "MFA admin can manage unavailable dates"
on public.public_unavailable_dates
for all
to authenticated
using (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
)
with check (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

drop policy if exists "Allow Ayesha page in-person availability inserts"
on public.in_person_availability;
drop policy if exists "Allow Ayesha page in-person availability updates"
on public.in_person_availability;

drop policy if exists "MFA admin can read in-person availability"
on public.in_person_availability;
create policy "MFA admin can read in-person availability"
on public.in_person_availability
for select
to authenticated
using (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

drop policy if exists "MFA admin can manage in-person availability"
on public.in_person_availability;
create policy "MFA admin can manage in-person availability"
on public.in_person_availability
for all
to authenticated
using (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
)
with check (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

drop policy if exists "MFA admin can create booking requests"
on public.booking_requests;
create policy "MFA admin can create booking requests"
on public.booking_requests
for insert
to authenticated
with check (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

drop policy if exists "MFA admin can read booking requests"
on public.booking_requests;
create policy "MFA admin can read booking requests"
on public.booking_requests
for select
to authenticated
using (
  (select public.is_current_user_admin())
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

create index if not exists clients_status_idx on public.clients(status);
create index if not exists clients_record_type_idx on public.clients(record_type);
create index if not exists clients_surname_idx on public.clients(lower(surname));
create index if not exists client_audit_log_client_id_idx
on public.client_audit_log(client_id, changed_at desc);
