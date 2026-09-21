alter table public.clinical_note_attachments
add column if not exists abc_source jsonb;

comment on column public.clinical_note_attachments.abc_source is
  'Clinician-reviewed ABC title and box text used to create an editable Pages download.';
