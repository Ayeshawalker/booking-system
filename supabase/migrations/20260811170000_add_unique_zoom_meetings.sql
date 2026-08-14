alter table public.booking_requests
add column if not exists zoom_meeting_id text,
add column if not exists zoom_join_url text,
add column if not exists zoom_sync_status text not null default 'not_required',
add column if not exists zoom_sync_error text,
add column if not exists zoom_created_at timestamptz;

alter table public.booking_requests
drop constraint if exists booking_requests_zoom_sync_status_check;

alter table public.booking_requests
add constraint booking_requests_zoom_sync_status_check
check (zoom_sync_status in ('not_required', 'pending', 'created', 'failed'));

create index if not exists booking_requests_zoom_meeting_idx
on public.booking_requests(zoom_meeting_id)
where zoom_meeting_id is not null;
