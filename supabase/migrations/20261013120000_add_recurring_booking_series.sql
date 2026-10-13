alter table public.booking_requests
  add column if not exists recurring_series_id uuid,
  add column if not exists recurrence_frequency text,
  add column if not exists recurrence_sequence integer,
  add column if not exists recurrence_total integer;

alter table public.booking_requests
  drop constraint if exists booking_requests_recurrence_frequency_check;
alter table public.booking_requests
  add constraint booking_requests_recurrence_frequency_check
  check (recurrence_frequency is null or recurrence_frequency in ('Weekly', 'Fortnightly'));

alter table public.booking_requests
  drop constraint if exists booking_requests_recurrence_sequence_check;
alter table public.booking_requests
  add constraint booking_requests_recurrence_sequence_check
  check (recurrence_sequence is null or recurrence_sequence > 0);

alter table public.booking_requests
  drop constraint if exists booking_requests_recurrence_total_check;
alter table public.booking_requests
  add constraint booking_requests_recurrence_total_check
  check (recurrence_total is null or recurrence_total between 2 and 20);

create index if not exists booking_requests_recurring_series_idx
  on public.booking_requests(recurring_series_id, recurrence_sequence)
  where recurring_series_id is not null;
