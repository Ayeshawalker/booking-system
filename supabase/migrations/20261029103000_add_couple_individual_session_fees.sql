alter table public.clients
  add column if not exists couple_individual_online_fee_gbp numeric(8, 2),
  add column if not exists couple_individual_in_person_fee_gbp numeric(8, 2);

alter table public.clients
  drop constraint if exists clients_couple_individual_online_fee_gbp_check,
  drop constraint if exists clients_couple_individual_in_person_fee_gbp_check;

alter table public.clients
  add constraint clients_couple_individual_online_fee_gbp_check
    check (couple_individual_online_fee_gbp is null or couple_individual_online_fee_gbp >= 0),
  add constraint clients_couple_individual_in_person_fee_gbp_check
    check (couple_individual_in_person_fee_gbp is null or couple_individual_in_person_fee_gbp >= 0);

comment on column public.clients.couple_individual_online_fee_gbp is
  'Fee used when either partner in a couple record has an individual online session.';
comment on column public.clients.couple_individual_in_person_fee_gbp is
  'Fee used when either partner in a couple record has an individual in-person session.';
