-- Secure server-side note saves use the service role after independently
-- verifying the signed-in administrator. In that context auth.uid() is null,
-- so preserve the verified editor supplied by the save function.
create or replace function public.capture_clinical_note_version()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  next_version integer;
  editor_id uuid;
begin
  editor_id := coalesce(auth.uid(), new.updated_by, old.updated_by);

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
    (old.id, next_version, old.rough_note, old.final_note, old.status, editor_id,
     jsonb_build_object(
       'interventions', old.interventions,
       'resources_shared', old.resources_shared,
       'supervision_required', old.supervision_required,
       'supervision_question', old.supervision_question,
       'supervision_status', old.supervision_status,
       'supervision_discussed_at', old.supervision_discussed_at
     ));

  new.updated_at := now();
  new.updated_by := editor_id;
  return new;
end;
$$;
