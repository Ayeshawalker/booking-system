alter table public.invoice_profile
add column if not exists payment_link text;

alter table public.invoice_profile
drop constraint if exists invoice_profile_payment_link_check;

alter table public.invoice_profile
add constraint invoice_profile_payment_link_check
check (
  payment_link is null
  or payment_link ~ '^https://[^[:space:]]+$'
);
