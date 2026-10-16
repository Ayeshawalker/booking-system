alter table public.clients
  add column if not exists partner_one_client_id uuid references public.clients(id) on delete set null,
  add column if not exists partner_two_client_id uuid references public.clients(id) on delete set null;

alter table public.clients
  drop constraint if exists clients_partner_links_require_couple,
  add constraint clients_partner_links_require_couple check (
    record_type = 'Couple'
    or (partner_one_client_id is null and partner_two_client_id is null)
  ),
  drop constraint if exists clients_partner_links_are_distinct,
  add constraint clients_partner_links_are_distinct check (
    partner_one_client_id is null
    or partner_two_client_id is null
    or partner_one_client_id <> partner_two_client_id
  ),
  drop constraint if exists clients_partner_links_are_not_self,
  add constraint clients_partner_links_are_not_self check (
    partner_one_client_id is distinct from id
    and partner_two_client_id is distinct from id
  );

create unique index if not exists clients_unique_linked_couple_idx
  on public.clients (
    least(partner_one_client_id, partner_two_client_id),
    greatest(partner_one_client_id, partner_two_client_id)
  )
  where partner_one_client_id is not null
    and partner_two_client_id is not null;

create index if not exists clients_partner_one_client_id_idx
  on public.clients(partner_one_client_id)
  where partner_one_client_id is not null;

create index if not exists clients_partner_two_client_id_idx
  on public.clients(partner_two_client_id)
  where partner_two_client_id is not null;
