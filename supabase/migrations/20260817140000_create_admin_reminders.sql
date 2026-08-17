create table if not exists public.admin_reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  details text not null default '',
  client_id uuid references public.clients(id) on delete set null,
  due_date date,
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High')),
  status text not null default 'Pending' check (status in ('Pending', 'Waiting', 'Completed')),
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_reminders_due_idx
  on public.admin_reminders(status, due_date, created_at);

alter table public.admin_reminders enable row level security;

drop policy if exists "Admins manage reminders" on public.admin_reminders;
create policy "Admins manage reminders" on public.admin_reminders
for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

grant select, insert, update, delete on public.admin_reminders to authenticated;
revoke all on public.admin_reminders from anon;
