-- A booking must never be rolled back because its invoice could not be created.
drop trigger if exists create_invoice_after_booking on public.booking_requests;
