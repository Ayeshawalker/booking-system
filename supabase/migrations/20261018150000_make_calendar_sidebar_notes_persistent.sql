-- Preserve all historical weekly notes, while copying each client's most
-- recently updated non-empty note into the reserved persistent-note row.
insert into public.client_calendar_notes (
  client_id,
  week_start,
  note,
  updated_by,
  updated_at
)
select distinct on (client_id)
  client_id,
  date '1970-01-05',
  note,
  updated_by,
  now()
from public.client_calendar_notes
where nullif(trim(note), '') is not null
  and week_start <> date '1970-01-05'
order by client_id, updated_at desc
on conflict (client_id, week_start) do nothing;
