insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-note-images',
  'clinical-note-images',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.clinical_note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.clinical_notes(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 8388608),
  caption text not null default '',
  display_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists clinical_note_attachments_note_idx
  on public.clinical_note_attachments(note_id, display_order, created_at);

alter table public.clinical_note_attachments enable row level security;

drop policy if exists "Admins manage clinical note attachments" on public.clinical_note_attachments;
create policy "Admins manage clinical note attachments" on public.clinical_note_attachments
for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

grant select, insert, update, delete on public.clinical_note_attachments to authenticated;
revoke all on public.clinical_note_attachments from anon;

drop policy if exists "Admins view clinical note images" on storage.objects;
create policy "Admins view clinical note images" on storage.objects
for select to authenticated
using (bucket_id = 'clinical-note-images' and public.is_current_user_admin());

drop policy if exists "Admins add clinical note images" on storage.objects;
create policy "Admins add clinical note images" on storage.objects
for insert to authenticated
with check (bucket_id = 'clinical-note-images' and public.is_current_user_admin());

drop policy if exists "Admins update clinical note images" on storage.objects;
create policy "Admins update clinical note images" on storage.objects
for update to authenticated
using (bucket_id = 'clinical-note-images' and public.is_current_user_admin())
with check (bucket_id = 'clinical-note-images' and public.is_current_user_admin());

drop policy if exists "Admins delete clinical note images" on storage.objects;
create policy "Admins delete clinical note images" on storage.objects
for delete to authenticated
using (bucket_id = 'clinical-note-images' and public.is_current_user_admin());
