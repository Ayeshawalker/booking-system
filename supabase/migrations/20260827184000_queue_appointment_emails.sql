create table if not exists public.appointment_email_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  action text not null check (action in ('send_confirmation', 'test_reminder')),
  requested_by uuid not null,
  requested_email text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointment_email_jobs enable row level security;
revoke all on public.appointment_email_jobs from anon, authenticated;

create or replace function public.queue_appointment_email(p_booking_id uuid, p_action text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_id uuid;
  v_email text;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Not authorised';
  end if;
  if p_action not in ('send_confirmation', 'test_reminder') then
    raise exception 'Unsupported email action';
  end if;
  if not exists (select 1 from public.booking_requests where id = p_booking_id and status = 'confirmed') then
    raise exception 'Only confirmed bookings can be emailed';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.appointment_email_jobs (booking_id, action, requested_by, requested_email)
  values (p_booking_id, p_action, auth.uid(), v_email)
  returning id into v_job_id;
  perform net.http_post(
    url := 'https://kxewsanwjfyitsdcvvzo.supabase.co/functions/v1/appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Ts6HJ1NM2pVkFO4eXbD1HA_kaqXpZ6A'
    ),
    body := jsonb_build_object('action', 'process_job', 'jobId', v_job_id)
  );
  return v_job_id;
end;
$$;

create or replace function public.appointment_email_job_status(p_job_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.admin_users where user_id = auth.uid()) then
      coalesce((select jsonb_build_object('status', status, 'result', result, 'error', last_error)
                from public.appointment_email_jobs where id = p_job_id and requested_by = auth.uid()),
               jsonb_build_object('status', 'missing', 'error', 'Email request not found.'))
    else jsonb_build_object('status', 'failed', 'error', 'Not authorised')
  end;
$$;

grant execute on function public.queue_appointment_email(uuid, text) to authenticated;
grant execute on function public.appointment_email_job_status(uuid) to authenticated;
