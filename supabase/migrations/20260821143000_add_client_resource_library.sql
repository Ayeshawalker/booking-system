insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-resources',
  'client-resources',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.client_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 15728640),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_resource_shares (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  resource_id uuid not null references public.client_resources(id) on delete restrict,
  sharing_method text not null default 'WhatsApp link',
  shared_by uuid not null default auth.uid() references auth.users(id),
  shared_at timestamptz not null default now()
);

create index if not exists client_resources_active_title_idx
  on public.client_resources(active, title);
create index if not exists client_resource_shares_client_date_idx
  on public.client_resource_shares(client_id, shared_at desc);

alter table public.client_resources enable row level security;
alter table public.client_resource_shares enable row level security;

drop policy if exists "Admins manage client resources" on public.client_resources;
create policy "Admins manage client resources" on public.client_resources
for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "Admins manage client resource shares" on public.client_resource_shares;
create policy "Admins manage client resource shares" on public.client_resource_shares
for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

grant select, insert, update, delete on public.client_resources to authenticated;
grant select, insert, update, delete on public.client_resource_shares to authenticated;
revoke all on public.client_resources from anon;
revoke all on public.client_resource_shares from anon;

drop policy if exists "Admins view client resources" on storage.objects;
create policy "Admins view client resources" on storage.objects
for select to authenticated
using (bucket_id = 'client-resources' and public.is_current_user_admin());

drop policy if exists "Admins add client resources" on storage.objects;
create policy "Admins add client resources" on storage.objects
for insert to authenticated
with check (bucket_id = 'client-resources' and public.is_current_user_admin());

drop policy if exists "Admins update client resources" on storage.objects;
create policy "Admins update client resources" on storage.objects
for update to authenticated
using (bucket_id = 'client-resources' and public.is_current_user_admin())
with check (bucket_id = 'client-resources' and public.is_current_user_admin());

drop policy if exists "Admins delete client resources" on storage.objects;
create policy "Admins delete client resources" on storage.objects
for delete to authenticated
using (bucket_id = 'client-resources' and public.is_current_user_admin());
