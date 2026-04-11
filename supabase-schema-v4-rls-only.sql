-- ============================================================
-- nizur.io — RLS ONLY — correr DESPUÉS de schema-v4-definitive
-- ============================================================

begin;

-- Habilitar RLS en todas las tablas
alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.company_users enable row level security;
alter table public.markets enable row level security;
alter table public.insureds enable row level security;
alter table public.brokers enable row level security;
alter table public.market_contacts enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_documents enable row level security;
alter table public.opportunities enable row level security;
alter table public.notes enable row level security;
alter table public.submission_markets enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_terms enable row level security;
alter table public.generated_outputs enable row level security;
alter table public.document_versions enable row level security;
alter table public.missing_information enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;
alter table public.placements enable row level security;
alter table public.placement_lines enable row level security;
alter table public.endorsements enable row level security;
alter table public.endorsement_lines enable row level security;
alter table public.financial_documents enable row level security;
alter table public.premium_adjustments enable row level security;
alter table public.premium_adjustment_lines enable row level security;
alter table public.bordereaux enable row level security;
alter table public.bordereaux_lines enable row level security;

-- Markets: lectura global para autenticados
drop policy if exists markets_read_all on public.markets;
create policy markets_read_all on public.markets
  for select to authenticated using (true);

-- User profiles: ven el propio o super_admin ve todos
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (auth.uid() = auth_user_id or public.is_super_admin(auth.uid()));

-- Companies: acceso por función can_access_company
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (public.can_access_company(id));

-- Company users
drop policy if exists company_users_select on public.company_users;
create policy company_users_select on public.company_users
  for select to authenticated
  using (public.is_super_admin(auth.uid()) or public.can_access_company(company_id));

-- Tablas con company_id: política tenant uniforme
drop policy if exists insureds_tenant on public.insureds;
create policy insureds_tenant on public.insureds for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists brokers_tenant on public.brokers;
create policy brokers_tenant on public.brokers for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists market_contacts_tenant on public.market_contacts;
create policy market_contacts_tenant on public.market_contacts for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists submissions_tenant on public.submissions;
create policy submissions_tenant on public.submissions for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists submission_documents_tenant on public.submission_documents;
create policy submission_documents_tenant on public.submission_documents for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists opportunities_tenant on public.opportunities;
create policy opportunities_tenant on public.opportunities for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists notes_tenant on public.notes;
create policy notes_tenant on public.notes for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists submission_markets_tenant on public.submission_markets;
create policy submission_markets_tenant on public.submission_markets for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists quotes_tenant on public.quotes;
create policy quotes_tenant on public.quotes for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists quote_terms_tenant on public.quote_terms;
create policy quote_terms_tenant on public.quote_terms for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists generated_outputs_tenant on public.generated_outputs;
create policy generated_outputs_tenant on public.generated_outputs for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists document_versions_tenant on public.document_versions;
create policy document_versions_tenant on public.document_versions for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists missing_information_tenant on public.missing_information;
create policy missing_information_tenant on public.missing_information for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists tasks_tenant on public.tasks;
create policy tasks_tenant on public.tasks for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists activities_tenant on public.activities;
create policy activities_tenant on public.activities for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists placements_tenant on public.placements;
create policy placements_tenant on public.placements for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists placement_lines_tenant on public.placement_lines;
create policy placement_lines_tenant on public.placement_lines for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists endorsements_tenant on public.endorsements;
create policy endorsements_tenant on public.endorsements for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists endorsement_lines_tenant on public.endorsement_lines;
create policy endorsement_lines_tenant on public.endorsement_lines for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists financial_documents_tenant on public.financial_documents;
create policy financial_documents_tenant on public.financial_documents for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists premium_adjustments_tenant on public.premium_adjustments;
create policy premium_adjustments_tenant on public.premium_adjustments for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists premium_adjustment_lines_tenant on public.premium_adjustment_lines;
create policy premium_adjustment_lines_tenant on public.premium_adjustment_lines for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists bordereaux_tenant on public.bordereaux;
create policy bordereaux_tenant on public.bordereaux for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

drop policy if exists bordereaux_lines_tenant on public.bordereaux_lines;
create policy bordereaux_lines_tenant on public.bordereaux_lines for all to authenticated
  using (public.can_access_company(company_id)) with check (public.can_access_company(company_id));

commit;
