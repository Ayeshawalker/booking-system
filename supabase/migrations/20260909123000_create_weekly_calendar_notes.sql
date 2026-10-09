create table if not exists public.client_calendar_notes (
  client_id uuid not null references public.clients(id) on delete cascade,
  week_start date not null,
  note text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (client_id, week_start)
);

alter table public.client_calendar_notes enable row level security;

revoke all on public.client_calendar_notes from anon;
grant select, insert, update, delete on public.client_calendar_notes to authenticated;

drop policy if exists "Admin can read weekly calendar notes"
on public.client_calendar_notes;
create policy "Admin can read weekly calendar notes"
on public.client_calendar_notes
for select
to authenticated
using ((select public.is_current_user_admin()));

drop policy if exists "Admin can create weekly calendar notes"
on public.client_calendar_notes;
create policy "Admin can create weekly calendar notes"
on public.client_calendar_notes
for insert
to authenticated
with check ((select public.is_current_user_admin()));

drop policy if exists "Admin can update weekly calendar notes"
on public.client_calendar_notes;
create policy "Admin can update weekly calendar notes"
on public.client_calendar_notes
for update
to authenticated
using ((select public.is_current_user_admin()))
with check ((select public.is_current_user_admin()));

drop policy if exists "Admin can delete weekly calendar notes"
on public.client_calendar_notes;
create policy "Admin can delete weekly calendar notes"
on public.client_calendar_notes
for delete
to authenticated
using ((select public.is_current_user_admin()));