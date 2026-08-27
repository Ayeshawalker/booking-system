alter table public.client_intake_forms drop constraint if exists client_intake_forms_form_type_check;
alter table public.client_intake_forms add constraint client_intake_forms_form_type_check
  check (form_type in ('Betrayal trauma', 'Individual', 'Couple', 'Impact statement'));
