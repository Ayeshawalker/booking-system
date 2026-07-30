alter table public.booking_requests
add column if not exists payment_status text not null default 'not_started',
add column if not exists stripe_checkout_session_id text,
add column if not exists stripe_payment_intent_id text,
add column if not exists stripe_checkout_url text,
add column if not exists stripe_checkout_expires_at timestamptz,
add column if not exists stripe_paid_at timestamptz,
add column if not exists payment_failure_message text;

alter table public.booking_requests
drop constraint if exists booking_requests_payment_status_check;

alter table public.booking_requests
add constraint booking_requests_payment_status_check
check (payment_status in (
  'not_started', 'pending', 'paid', 'part_paid', 'failed', 'expired', 'refunded'
));

create unique index if not exists booking_requests_stripe_checkout_session_idx
on public.booking_requests(stripe_checkout_session_id)
where stripe_checkout_session_id is not null;

create index if not exists booking_requests_payment_status_idx
on public.booking_requests(payment_status, preferred_date);
