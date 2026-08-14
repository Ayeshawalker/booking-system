create table if not exists public.client_agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agreement_type text not null check (agreement_type in ('Individual', 'Couple')),
  agreement_version text not null,
  agreement_text text not null,
  access_token uuid not null default gen_random_uuid() unique,
  status text not null default 'Sent'
    check (status in ('Sent', 'Partially signed', 'Signed', 'Cancelled')),
  signer_one_expected_name text not null,
  signer_two_expected_name text,
  signer_one_name text,
  signer_one_signed_at timestamptz,
  signer_one_whatsapp_consent boolean,
  signer_one_contact_alternative text,
  signer_two_name text,
  signer_two_signed_at timestamptz,
  signer_two_whatsapp_consent boolean,
  signer_two_contact_alternative text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists client_agreements_client_id_idx
  on public.client_agreements(client_id, created_at desc);

alter table public.client_agreements enable row level security;

drop policy if exists "Admins can view client agreements" on public.client_agreements;
create policy "Admins can view client agreements"
on public.client_agreements for select to authenticated
using (public.is_current_user_admin());

drop policy if exists "Admins can create client agreements" on public.client_agreements;
create policy "Admins can create client agreements"
on public.client_agreements for insert to authenticated
with check (public.is_current_user_admin() and created_by = auth.uid());

drop policy if exists "Admins can update client agreements" on public.client_agreements;
create policy "Admins can update client agreements"
on public.client_agreements for update to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "Admins can delete client agreements" on public.client_agreements;
create policy "Admins can delete client agreements"
on public.client_agreements for delete to authenticated
using (public.is_current_user_admin());

revoke all on public.client_agreements from anon;
grant select, insert, update, delete on public.client_agreements to authenticated;

