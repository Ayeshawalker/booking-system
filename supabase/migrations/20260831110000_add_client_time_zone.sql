alter table public.clients
  add column if not exists client_time_zone text not null default 'Europe/London';

alter table public.clients
  drop constraint if exists clients_client_time_zone_check;

alter table public.clients
  add constraint clients_client_time_zone_check check (
    client_time_zone in (
      'Europe/London',
      'Europe/Paris',
      'Europe/Dublin',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Australia/Sydney',
      'Pacific/Auckland'
    )
  );

comment on column public.clients.client_time_zone is
  'IANA time zone used to show the client their local appointment time alongside UK time.';
