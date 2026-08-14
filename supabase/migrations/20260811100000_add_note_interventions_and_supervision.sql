alter table public.clinical_notes
  add column if not exists interventions text[] not null default '{}',
  add column if not exists resources_shared text[] not null default '{}',
  add column if not exists supervision_required boolean not null default false,
  add column if not exists supervision_question text not null default '',
  add column if not exists supervision_status text not null default 'Not required',
  add column if not exists supervision_discussed_at timestamptz;

alter table public.clinical_notes
  drop constraint if exists clinical_notes_supervision_status_check;
alter table public.clinical_notes
  add constraint clinical_notes_supervision_status_check
  check (supervision_status in ('Not required', 'Outstanding', 'Discussed'));

alter table public.clinical_note_versions
  add column if not exists structured_details jsonb not null default '{}'::jsonb;

create index if not exists clinical_notes_supervision_idx
  on public.clinical_notes(supervision_status, note_date desc)
  where supervision_required = true and archived_at is null;

create or replace function public.capture_clinical_note_version()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_version integer;
begin
  if old.rough_note is not distinct from new.rough_note
     and old.final_note is not distinct from new.final_note
     and old.status is not distinct from new.status
     and old.interventions is not distinct from new.interventions
     and old.resources_shared is not distinct from new.resources_shared
     and old.supervision_required is not distinct from new.supervision_required
     and old.supervision_question is not distinct from new.supervision_question
     and old.supervision_status is not distinct from new.supervision_status then
    return new;
  end if;
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.clinical_note_versions where note_id = old.id;
  insert into public.clinical_note_versions
    (note_id, version_number, rough_note, final_note, status, changed_by, structured_details)
  values
    (old.id, next_version, old.rough_note, old.final_note, old.status, auth.uid(),
     jsonb_build_object(
       'interventions', old.interventions,
       'resources_shared', old.resources_shared,
       'supervision_required', old.supervision_required,
       'supervision_question', old.supervision_question,
       'supervision_status', old.supervision_status,
       'supervision_discussed_at', old.supervision_discussed_at
     ));
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
