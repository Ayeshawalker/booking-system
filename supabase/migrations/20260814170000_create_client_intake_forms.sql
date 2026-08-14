create table if not exists public.client_intake_forms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  form_type text not null default 'Betrayal trauma'
    check (form_type in ('Betrayal trauma', 'Individual', 'Couple')),
  form_version text not null,
  access_token uuid not null default gen_random_uuid() unique,
  status text not null default 'Sent'
    check (status in ('Sent', 'Completed', 'Cancelled')),
  answers jsonb not null default '{}'::jsonb,
  signer_name text,
  signed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists client_intake_forms_client_id_idx
  on public.client_intake_forms(client_id, created_at desc);

alter table public.client_intake_forms enable row level security;

drop policy if exists "Admins can view client intake forms" on public.client_intake_forms;
create policy "Admins can view client intake forms"
on public.client_intake_forms for select to authenticated
using (public.is_current_user_admin());

drop policy if exists "Admins can create client intake forms" on public.client_intake_forms;
create policy "Admins can create client intake forms"
on public.client_intake_forms for insert to authenticated
with check (public.is_current_user_admin() and created_by = auth.uid());

drop policy if exists "Admins can update client intake forms" on public.client_intake_forms;
create policy "Admins can update client intake forms"
on public.client_intake_forms for update to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "Admins can delete client intake forms" on public.client_intake_forms;
create policy "Admins can delete client intake forms"
on public.client_intake_forms for delete to authenticated
using (public.is_current_user_admin());

revoke all on public.client_intake_forms from anon;
grant select, insert, update, delete on public.client_intake_forms to authenticated;
