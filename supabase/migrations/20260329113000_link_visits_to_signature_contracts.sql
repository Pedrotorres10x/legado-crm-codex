alter table public.visits
add column if not exists signature_contract_id uuid references public.generated_contracts(id) on delete set null;

create index if not exists visits_signature_contract_id_idx
on public.visits(signature_contract_id);
