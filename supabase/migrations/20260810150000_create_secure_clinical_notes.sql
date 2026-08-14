create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  note_date date not null,
  note_type text not null default 'Session note'
    check (note_type in ('Session note', 'Admin note', 'Follow-up note', 'Risk/admin flag')),
  rough_note text not null default '',
  final_note text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Final')),
  retention_review_date date,
  ai_assisted boolean not null default false,
  ai_model text,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalised_at timestamptz,
  archived_at timestamptz,
  archived_by uuid references auth.users(id)
);

create table if not exists public.clinical_note_versions (
  id bigint generated always as identity primary key,
  note_id uuid not null references public.clinical_notes(id) on delete cascade,
  version_number integer not null,
  rough_note text not null,
  final_note text not null,
  status text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  change_reason text,
  unique(note_id, version_number)
);

create index if not exists clinical_notes_client_date_idx
  on public.clinical_notes(client_id, note_date desc)
  where archived_at is null;

alter table public.clinical_notes enable row level security;
alter table public.clinical_note_versions enable row level security;

drop policy if exists "Admins manage clinical notes" on public.clinical_notes;
create policy "Admins manage clinical notes" on public.clinical_notes
for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "Admins view clinical note versions" on public.clinical_note_versions;
create policy "Admins view clinical note versions" on public.clinical_note_versions
for select to authenticated using (public.is_current_user_admin());

grant select, insert, update on public.clinical_notes to authenticated;
grant select on public.clinical_note_versions to authenticated;
revoke all on public.clinical_notes from anon;
revoke all on public.clinical_note_versions from anon;

create or replace function public.capture_clinical_note_version()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_version integer;
begin
  if old.rough_note is not distinct from new.rough_note
     and old.final_note is not distinct from new.final_note
     and old.status is not distinct from new.status then
    return new;
  end if;
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.clinical_note_versions where note_id = old.id;
  insert into public.clinical_note_versions
    (note_id, version_number, rough_note, final_note, status, changed_by)
  values
    (old.id, next_version, old.rough_note, old.final_note, old.status, auth.uid());
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists capture_clinical_note_version_trigger on public.clinical_notes;
create trigger capture_clinical_note_version_trigger
before update on public.clinical_notes
for each row execute function public.capture_clinical_note_version();

