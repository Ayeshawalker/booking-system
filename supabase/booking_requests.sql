create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_type text not null check (
    session_type in ('Individual session', 'Joint session', 'Discovery call')
  ),
  session_format text not null check (
    session_format in ('Online', 'In person', 'Telephone call', 'Zoom call')
  ),
  booking_source text not null default 'Client booking' check (
    booking_source in ('Client booking', 'Ayesha booking for client')
  ),
  client_type text not null default 'New client' check (
    client_type in ('New client', 'Existing client')
  ),
  booking_type text not null default 'Single session' check (
    booking_type in ('Single session', 'Block booking')
  ),
  block_session_count integer,
  block_date_pattern text check (
    block_date_pattern in ('Regular pattern', 'Flexible dates')
  ),
  block_frequency text check (
    block_frequency in ('Weekly', 'Fortnightly')
  ),
  flexible_block_preferences text,
  block_payment_preference text check (
    block_payment_preference in ('Pay all upfront', 'Pay first session now')
  ),
  block_cancellation_agreement boolean not null default false,
  price integer,
  total_cost integer,
  pay_now_amount integer,
  remaining_balance integer,
  invoice_required boolean not null default false,
  invoice_amount integer,
  invoice_note text,
  payment_reminder_required boolean not null default false,
  next_payment_due_amount integer,
  payment_reminder_note text,
  proposed_block_dates jsonb,
  exact_block_dates jsonb,
  calendar_sync_status text not null default 'pending' check (
    calendar_sync_status in ('pending', 'synced', 'partial', 'failed')
  ),
  calendar_event_ids jsonb not null default '[]'::jsonb,
  calendar_sync_error text,
  calendar_synced_at timestamptz,
  duration text not null,
  preferred_date date not null,
  preferred_time time not null,
  first_name text,
  surname text,
  second_first_name text,
  second_surname text,
  email text not null,
  phone text,
  message text,
  consent_to_contact boolean not null default true,
  status text not null default 'new' check (
    status in ('new', 'contacted', 'confirmed', 'closed')
  )
);

alter table public.booking_requests
add column if not exists client_type text not null default 'New client';

alter table public.booking_requests
add column if not exists booking_source text not null default 'Client booking',
add column if not exists booking_type text not null default 'Single session',
add column if not exists block_session_count integer,
add column if not exists block_date_pattern text,
add column if not exists block_frequency text,
add column if not exists flexible_block_preferences text,
add column if not exists block_payment_preference text,
add column if not exists block_cancellation_agreement boolean not null default false,
add column if not exists price integer,
add column if not exists total_cost integer,
add column if not exists pay_now_amount integer,
add column if not exists remaining_balance integer,
add column if not exists invoice_required boolean not null default false,
add column if not exists invoice_amount integer,
add column if not exists invoice_note text,
add column if not exists payment_reminder_required boolean not null default false,
add column if not exists next_payment_due_amount integer,
add column if not exists payment_reminder_note text,
add column if not exists proposed_block_dates jsonb,
add column if not exists exact_block_dates jsonb,
add column if not exists calendar_sync_status text not null default 'pending',
add column if not exists calendar_event_ids jsonb not null default '[]'::jsonb,
add column if not exists calendar_sync_error text,
add column if not exists calendar_synced_at timestamptz,
add column if not exists second_first_name text,
add column if not exists second_surname text;

alter table public.booking_requests
alter column first_name drop not null,
alter column surname drop not null,
alter column phone drop not null;

alter table public.booking_requests
drop constraint if exists booking_requests_client_type_check;

alter table public.booking_requests
add constraint booking_requests_client_type_check
check (client_type in ('New client', 'Existing client'));

alter table public.booking_requests
drop constraint if exists booking_requests_booking_source_check;

alter table public.booking_requests
add constraint booking_requests_booking_source_check
check (booking_source in ('Client booking', 'Ayesha booking for client'));

alter table public.booking_requests
drop constraint if exists booking_requests_booking_type_check;

alter table public.booking_requests
add constraint booking_requests_booking_type_check
check (booking_type in ('Single session', 'Block booking'));

alter table public.booking_requests
drop constraint if exists booking_requests_block_frequency_check;

alter table public.booking_requests
add constraint booking_requests_block_frequency_check
check (block_frequency is null or block_frequency in ('Weekly', 'Fortnightly'));

alter table public.booking_requests
drop constraint if exists booking_requests_block_date_pattern_check;

alter table public.booking_requests
add constraint booking_requests_block_date_pattern_check
check (
  block_date_pattern is null
  or block_date_pattern in ('Regular pattern', 'Flexible dates')
);

alter table public.booking_requests
drop constraint if exists booking_requests_block_payment_preference_check;

alter table public.booking_requests
add constraint booking_requests_block_payment_preference_check
check (
  block_payment_preference is null
  or block_payment_preference in ('Pay all upfront', 'Pay first session now')
);

alter table public.booking_requests
drop constraint if exists booking_requests_calendar_sync_status_check;

alter table public.booking_requests
add constraint booking_requests_calendar_sync_status_check
check (calendar_sync_status in ('pending', 'synced', 'partial', 'failed'));

alter table public.booking_requests enable row level security;

drop policy if exists "Allow public booking request inserts" on public.booking_requests;

create policy "Allow public booking request inserts"
on public.booking_requests
for insert
to anon
with check (true);

create table if not exists public.in_person_availability (
  week_start date primary key,
  available_dates date[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.in_person_availability enable row level security;

drop policy if exists "Allow public in-person availability reads" on public.in_person_availability;

create policy "Allow public in-person availability reads"
on public.in_person_availability
for select
to anon
using (true);

drop policy if exists "Allow Ayesha page in-person availability inserts" on public.in_person_availability;

create policy "Allow Ayesha page in-person availability inserts"
on public.in_person_availability
for insert
to anon
with check (true);

drop policy if exists "Allow Ayesha page in-person availability updates" on public.in_person_availability;

create policy "Allow Ayesha page in-person availability updates"
on public.in_person_availability
for update
to anon
using (true)
with check (true);
