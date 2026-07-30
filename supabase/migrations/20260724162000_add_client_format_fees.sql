alter table public.clients
add column if not exists agreed_online_fee_gbp numeric(8, 2),
add column if not exists agreed_in_person_fee_gbp numeric(8, 2);

alter table public.clients
drop constraint if exists clients_agreed_online_fee_gbp_check,
drop constraint if exists clients_agreed_in_person_fee_gbp_check;

alter table public.clients
add constraint clients_agreed_online_fee_gbp_check
check (agreed_online_fee_gbp is null or agreed_online_fee_gbp >= 0),
add constraint clients_agreed_in_person_fee_gbp_check
check (agreed_in_person_fee_gbp is null or agreed_in_person_fee_gbp >= 0);
