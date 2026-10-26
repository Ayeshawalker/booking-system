alter table public.admin_reminders
add column if not exists due_time time;
