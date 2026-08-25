alter table public.client_agreements
drop constraint if exists client_agreements_agreement_type_check;

alter table public.client_agreements
add constraint client_agreements_agreement_type_check
check (agreement_type in ('Individual', 'Standard individual', 'Betrayal trauma', 'Couple'));

notify pgrst, 'reload schema';
