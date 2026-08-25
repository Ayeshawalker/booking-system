alter table public.invoices
add column if not exists payment_link text;

alter table public.invoices
drop constraint if exists invoices_payment_link_check;

alter table public.invoices
add constraint invoices_payment_link_check
check (
  payment_link is null
  or payment_link ~ '^https://[^[:space:]]+$'
);
