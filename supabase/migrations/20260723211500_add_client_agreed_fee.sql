alter table public.clients
add column if not exists agreed_session_fee_gbp numeric(8, 2),
add column if not exists fee_arrangement text not null default 'To be agreed',
add column if not exists fee_notes text;

alter table public.clients
drop constraint if exists clients_agreed_session_fee_gbp_check;

alter table public.clients
add constraint clients_agreed_session_fee_gbp_check
check (
  agreed_session_fee_gbp is null
  or agreed_session_fee_gbp >= 0
);

alter table public.clients
drop constraint if exists clients_fee_arrangement_check;

alter table public.clients
add constraint clients_fee_arrangement_check
check (
  fee_arrangement in (
    'To be agreed',
    'Standard',
    'Reduced',
    'Complimentary',
    'Other'
  )
);
