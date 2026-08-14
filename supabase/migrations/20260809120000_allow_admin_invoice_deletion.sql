-- Allow only an approved signed-in administrator to remove an incorrect invoice.
-- Session and payment-history records are stored separately and are not deleted.

grant delete on public.invoices to authenticated;

drop policy if exists "Approved admin can delete invoices" on public.invoices;
create policy "Approved admin can delete invoices"
on public.invoices for delete to authenticated
using (public.is_current_user_admin());
