alter table public.booking_requests
add column if not exists calendar_sync_status text not null default 'pending',
add column if not exists calendar_event_ids jsonb not null default '[]'::jsonb,
add column if not exists calendar_sync_error text,
add column if not exists calendar_synced_at timestamptz;

alter table public.booking_requests
drop constraint if exists booking_requests_calendar_sync_status_check;

alter table public.booking_requests
add constraint booking_requests_calendar_sync_status_check
check (calendar_sync_status in ('pending', 'synced', 'partial', 'failed'));
