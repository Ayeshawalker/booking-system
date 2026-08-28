alter table public.appointment_email_jobs
  drop constraint if exists appointment_email_jobs_action_check;

alter table public.appointment_email_jobs
  add constraint appointment_email_jobs_action_check
  check (action in ('send_confirmation', 'test_reminder', 'send_cancellation', 'send_reschedule'));

create or replace function public.queue_appointment_email(p_booking_id uuid, p_action text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_id uuid;
  v_email text;
  v_status text;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Not authorised';
  end if;
  if p_action not in ('send_confirmation', 'test_reminder', 'send_cancellation', 'send_reschedule') then
    raise exception 'Unsupported email action';
  end if;
  select status into v_status from public.booking_requests where id = p_booking_id;
  if v_status is null or (p_action = 'send_cancellation' and v_status <> 'closed')
     or (p_action <> 'send_cancellation' and v_status <> 'confirmed') then
    raise exception 'The booking status does not match this email';
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
