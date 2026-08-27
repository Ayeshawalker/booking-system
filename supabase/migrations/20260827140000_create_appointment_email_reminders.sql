create table if not exists public.appointment_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  occurrence_date date not null,
  occurrence_time time not null,
  recipient_email text not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'failed')),
  attempt_count integer not null default 1,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, occurrence_date, occurrence_time, recipient_email)
);

alter table public.booking_requests
add column if not exists email_notifications_enabled boolean not null default false;

create table if not exists public.booking_confirmation_deliveries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'failed')),
  attempt_count integer not null default 1,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, recipient_email)
);

create index if not exists appointment_reminder_deliveries_status_idx
on public.appointment_reminder_deliveries(status, occurrence_date);

alter table public.appointment_reminder_deliveries enable row level security;
alter table public.booking_confirmation_deliveries enable row level security;

revoke all on public.appointment_reminder_deliveries from anon, authenticated;
revoke all on public.booking_confirmation_deliveries from anon, authenticated;

comment on table public.appointment_reminder_deliveries is
  'Private delivery log used to prevent duplicate client appointment reminders.';

-- The Edge Function is invoked every morning at 08:00 London time. Supabase
-- Cron schedules use UTC, so two jobs cover British winter and summer time.
-- The function itself only sends between 07:50 and 08:10 Europe/London, making
-- the inactive seasonal job a harmless no-op.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'appointment-reminders-0800-gmt',
  'appointment-reminders-0800-bst'
);

select cron.schedule(
  'appointment-reminders-0800-gmt',
  '0 8 * * *',
  $schedule$
  select net.http_post(
    url := 'https://kxewsanwjfyitsdcvvzo.supabase.co/functions/v1/appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Ts6HJ1NM2pVkFO4eXbD1HA_kaqXpZ6A'
    ),
    body := '{"scheduled":true}'::jsonb
  );
  $schedule$
);

select cron.schedule(
  'appointment-reminders-0800-bst',
  '0 7 * * *',
  $schedule$
  select net.http_post(
    url := 'https://kxewsanwjfyitsdcvvzo.supabase.co/functions/v1/appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Ts6HJ1NM2pVkFO4eXbD1HA_kaqXpZ6A'
    ),
    body := '{"scheduled":true}'::jsonb
  );
  $schedule$
);
