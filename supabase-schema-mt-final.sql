-- Multi-tenant broker support schema for Supabase / PostgreSQL
-- nizur.io — Broker de Reaseguros Facultativos
-- Version: MT Final (con sugerencias Medivh)
-- Cambios vs MT base:
--   - reply_to_email en submissions
--   - chance_percent → weight_percent
--   - weighted_revenue usa weight_percent
--   - vistas con can_access_company explícito
-- IMPORTANTE: correr en staging primero

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'company_user_role') then
    create type public.company_user_role as enum (
      'company_admin', 'broker', 'broker_support', 'viewer'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'global_user_role') then
    create type public.global_user_role as enum ('super_admin', 'standard');
  end if;

  if not exists (select 1 from pg_type where typname = 'opportunity_stage_mt') then
    create type public.opportunity_stage_mt as enum (
      'intake', 'submission_preparation', 'marketed', 'quoted',
      'negotiation', 'ordered', 'bound', 'documentation',
      'invoiced', 'closed', 'lost'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status_mt') then
    create type public.submission_status_mt as enum (
      'received', 'triaged', 'drafting', 'ready_to_market', 'marketed', 'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_role_mt') then
    create type public.document_role_mt as enum (
      'incoming_submission', 'supporting_info', 'engineering_report',
      'loss_record', 'sov', 'quote', 'quote_slip', 'placement_slip',
      'cover_note', 'debit_note', 'credit_note', 'endorsement',
      'bw', 'email_attachment', 'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'market_submission_status_mt') then
    create type public.market_submission_status_mt as enum (
      'draft', 'ready', 'sent', 'acknowledged', 'responded',
      'declined', 'quoted', 'bound', 'withdrawn'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'quote_status_mt') then
    create type public.quote_status_mt as enum (
      'indicative', 'firm', 'expired', 'declined',
      'superseded', 'accepted', 'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'output_type_mt') then
    create type public.output_type_mt as enum (
      'executive_summary', 'underwriting_summary', 'engineering_summary',
      'missing_info_checklist', 'quote_slip_draft', 'placement_slip_draft',
      'cover_note_draft', 'debit_note_draft', 'credit_note_draft',
      'bw_draft', 'endorsement_draft', 'broker_email_draft',
      'market_email_draft', 'quote_comparison'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'output_status_mt') then
    create type public.output_status_mt as enum ('draft', 'reviewed', 'final', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'missing_severity_mt') then
    create type public.missing_severity_mt as enum ('low', 'medium', 'high', 'critical');
  end if;

  if not exists (select 1 from pg_type where typname = 'missing_status_mt') then
    create type public.missing_status_mt as enum ('open', 'requested', 'received', 'waived', 'closed');
  end if;

  if not exists (select 1 from pg_type where typname = 'placement_status_mt') then
    create type public.placement_status_mt as enum (
      'draft', 'ordered', 'bound', 'partially_signed', 'fully_signed', 'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'financial_doc_type_mt') then
    create type public.financial_doc_type_mt as enum (
      'debit_note', 'credit_note', 'invoice', 'statement',
      'bordereaux', 'commission_calc', 'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'endorsement_status_mt') then
    create type public.endorsement_status_mt as enum (
      'requested', 'drafting', 'quoted', 'approved', 'issued', 'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_type_mt') then
    create type public.activity_type_mt as enum (
      'submission_received', 'submission_updated', 'document_uploaded',
      'opportunity_created', 'stage_changed', 'market_email_prepared',
      'market_submission_sent', 'market_response_received', 'quote_received',
      'quote_updated', 'quote_selected', 'order_received', 'placement_created',
      'placement_bound', 'document_generated', 'document_finalized',
      'endorsement_requested', 'endorsement_issued', 'financial_document_created',
      'note_added'
    );
  end if;
end $$;

-- ============================================================
-- FUNCIONES UTILITARIAS
-- ============================================================

create or replace function public.set_updated_at_mt()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_opportunity_from_activity_mt()
returns trigger language plpgsql as $$
begin
  if new.opportunity_id is not null then
    update public.opportunities
       set last_activity_at = new.created_at, updated_at = now()
     where id = new.opportunity_id;
  end if;
  return new;
end;
$$;

-- ============================================================
-- MULTI-TENANCY: COMPANIES + USUARIOS
-- ============================================================

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  full_name text not null,
  email text,
  global_role public.global_user_role not null default 'standard',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  role public.company_user_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_profile_id)
);

-- Helpers de acceso
create or replace function public.is_super_admin(p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_profiles up
    where up.auth_user_id = p_user_id
      and up.global_role = 'super_admin'
      and up.is_active = true
  );
$$;

create or replace function public.user_belongs_to_company(p_user_id uuid, p_company_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.company_users cu
    join public.user_profiles up on up.id = cu.user_profile_id
    where up.auth_user_id = p_user_id
      and cu.company_id = p_company_id
      and cu.is_active = true
      and up.is_active = true
  );
$$;

create or replace function public.can_access_company(p_company_id uuid)
returns boolean language sql stable as $$
  select public.is_super_admin(auth.uid())
      or public.user_belongs_to_company(auth.uid(), p_company_id);
$$;

-- ============================================================
-- CORE: ASEGURADOS, BROKERS
-- ============================================================

create table if not exists public.insureds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  legal_name text,
  country text,
  industry text,
  subcategory text,
  website text,
  tax_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brokers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  legal_name text,
  country text,
  bank_account_details text,
  intermediary_clause_text text,
  legal_representative_name text,
  legal_representative_email text,
  signature_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MERCADOS (globales, compartidos entre empresas)
-- ============================================================

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  market_name text not null,
  market_group text,
  country text,
  market_type text,
  default_currency text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists markets_name_mt_uidx on public.markets(lower(market_name));

create table if not exists public.market_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  full_name text,
  email text not null,
  role_name text,
  line_of_business text,
  country text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SUBMISSIONS
-- ============================================================

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email_message_id text,
  source_email text,
  reply_to_email text,              -- ← NUEVO: dirección de respuesta al broker
  source_name text,
  subject text,
  email_body text,
  received_at timestamptz not null default now(),
  insured_id uuid references public.insureds(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  ramo text,
  submission_type text,
  currency text,
  sum_insured numeric(18,2),
  limit_amount numeric(18,2),
  estimated_premium numeric(18,2),
  policy_start date,
  policy_end date,
  status public.submission_status_mt not null default 'received',
  raw_llm_json jsonb not null default '{}'::jsonb,
  extraction_confidence numeric(5,2),
  needs_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists submissions_received_at_mt_idx on public.submissions(received_at desc);
create index if not exists submissions_status_mt_idx on public.submissions(status);

create table if not exists public.submission_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  file_name text not null,
  mime_type text,
  storage_path text not null,
  file_size integer,
  extracted_text text,
  document_role public.document_role_mt not null default 'other',
  language text,
  version_no integer not null default 1,
  created_at timestamptz not null default now()
);

-- ============================================================
-- OPPORTUNITIES
-- ============================================================

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  insured_id uuid references public.insureds(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  title text not null,
  category text,
  ramo text,
  country text,
  currency text,
  sum_insured numeric(18,2),
  limit_amount numeric(18,2),
  estimated_premium numeric(18,2),
  brokerage_estimated numeric(18,2),
  -- weight_percent reemplaza a chance_percent (vocabulario de mercado)
  weight_percent numeric(5,2) not null default 10.00 check (weight_percent >= 0 and weight_percent <= 100),
  weighted_revenue numeric(18,2) generated always as (
    coalesce(brokerage_estimated,0) * (coalesce(weight_percent,0) / 100.0)
  ) stored,
  policy_start date,
  policy_end date,
  deadline_at timestamptz,
  stage public.opportunity_stage_mt not null default 'intake',
  priority_score integer not null default 0 check (priority_score >= 0),
  owner_profile_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  unique (submission_id)
);
create index if not exists opportunities_stage_mt_idx on public.opportunities(stage);
create index if not exists opportunities_deadline_mt_idx on public.opportunities(deadline_at);

-- ============================================================
-- SUBMISSION → MERCADOS
-- ============================================================

create table if not exists public.submission_markets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  contact_id uuid references public.market_contacts(id) on delete set null,
  outbound_email_subject text,
  outbound_email_body text,
  sent_at timestamptz,
  last_response_at timestamptz,
  status public.market_submission_status_mt not null default 'draft',
  latest_response_summary text,
  response_requires_action boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, market_id)
);

-- ============================================================
-- QUOTES
-- ============================================================

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  submission_market_id uuid references public.submission_markets(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  quote_ref text,
  quote_status public.quote_status_mt not null default 'indicative',
  currency text,
  line_percent numeric(8,4),
  limit_amount numeric(18,2),
  premium_amount numeric(18,2),
  brokerage_percent numeric(8,4),
  brokerage_amount numeric(18,2),
  deductible_summary text,
  key_terms_summary text,
  exclusions_summary text,
  subjectivities_summary text,
  quote_received_at timestamptz not null default now(),
  valid_until timestamptz,
  source_document_id uuid references public.submission_documents(id) on delete set null,
  raw_quote_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_terms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  term_key text not null,
  term_label text not null,
  term_value text,
  term_numeric numeric(18,2),
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- OUTPUTS Y VERSIONADO
-- ============================================================

create table if not exists public.generated_outputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  output_type public.output_type_mt not null,
  version integer not null default 1,
  title text,
  content_markdown text not null,
  content_json jsonb,
  status public.output_status_mt not null default 'draft',
  created_by text not null default 'jaina',
  created_at timestamptz not null default now(),
  check (submission_id is not null or opportunity_id is not null)
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  source_output_id uuid references public.generated_outputs(id) on delete set null,
  document_role public.document_role_mt not null,
  version_no integer not null default 1,
  file_name text,
  storage_path text,
  markdown_snapshot text,
  json_snapshot jsonb,
  finalized boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- OPERACIÓN: FALTANTES, TAREAS, ACTIVIDAD
-- ============================================================

create table if not exists public.missing_information (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  field_name text not null,
  description text not null,
  severity public.missing_severity_mt not null default 'medium',
  blocks_quotation boolean not null default false,
  status public.missing_status_mt not null default 'open',
  requested_from text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (submission_id is not null or opportunity_id is not null)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  assigned_to_profile_id uuid references public.user_profiles(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete set null,
  activity_type public.activity_type_mt not null,
  activity_detail text,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (opportunity_id is not null or submission_id is not null)
);

-- ============================================================
-- CIERRE / COLOCACIÓN
-- ============================================================

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  order_received_at timestamptz,
  order_reference text,
  placement_status public.placement_status_mt not null default 'draft',
  final_currency text,
  final_limit_amount numeric(18,2),
  final_premium_amount numeric(18,2),
  final_brokerage_amount numeric(18,2),
  cover_note_output_id uuid references public.generated_outputs(id) on delete set null,
  bw_output_id uuid references public.generated_outputs(id) on delete set null,
  placement_slip_output_id uuid references public.generated_outputs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id)
);

create table if not exists public.placement_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  placement_id uuid not null references public.placements(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  signed_line_percent numeric(8,4),
  written_line_percent numeric(8,4),
  premium_amount numeric(18,2),
  brokerage_amount numeric(18,2),
  signed_confirmation_text text,
  signed_confirmation_document_id uuid references public.submission_documents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.final_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  placement_id uuid references public.placements(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  document_role public.document_role_mt not null,
  title text,
  storage_path text,
  generated_output_id uuid references public.generated_outputs(id) on delete set null,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ENDOSOS
-- ============================================================

create table if not exists public.endorsements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  placement_id uuid references public.placements(id) on delete set null,
  endorsement_status public.endorsement_status_mt not null default 'requested',
  endorsement_type text not null,
  effective_date date,
  description text,
  insured_change_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.endorsement_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  endorsement_id uuid not null references public.endorsements(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  line_percent numeric(8,4),
  rate_applied numeric(12,6),
  discount_applied numeric(12,6),
  premium_delta numeric(18,2),
  wording_notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- FINANCIERO
-- ============================================================

create table if not exists public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  placement_id uuid references public.placements(id) on delete cascade,
  endorsement_id uuid references public.endorsements(id) on delete cascade,
  document_type public.financial_doc_type_mt not null,
  counterparty_name text,
  amount numeric(18,2),
  currency text,
  storage_path text,
  generated_output_id uuid references public.generated_outputs(id) on delete set null,
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

do $trg$
declare
  t text;
begin
  foreach t in array array[
    'companies','user_profiles','company_users','insureds','brokers',
    'markets','market_contacts','submissions','opportunities',
    'submission_markets','quotes','missing_information','tasks',
    'placements','endorsements'
  ]
  loop
    execute format('
      drop trigger if exists trg_%s_updated_at_mt on public.%s;
      create trigger trg_%s_updated_at_mt
      before update on public.%s
      for each row execute function public.set_updated_at_mt();
    ', t, t, t, t);
  end loop;
end $trg$;

drop trigger if exists trg_activities_touch_opp_mt on public.activities;
create trigger trg_activities_touch_opp_mt
after insert on public.activities
for each row execute function public.touch_opportunity_from_activity_mt();

-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets (id, name, public)
values ('submission-files', 'submission-files', false)
on conflict (id) do nothing;

-- ============================================================
-- VISTAS
-- ============================================================

create or replace view public.pipeline_dashboard_view_mt as
select
  o.id,
  o.company_id,
  c.name as company_name,
  o.title,
  o.category,
  o.ramo,
  i.name as insured_name,
  coalesce(o.country, i.country) as country,
  o.currency,
  o.limit_amount,
  o.estimated_premium,
  o.brokerage_estimated,
  o.weight_percent,
  o.weighted_revenue,
  o.policy_start,
  o.policy_end,
  o.deadline_at,
  o.stage,
  o.priority_score,
  up.full_name as owner_name,
  o.created_at,
  o.updated_at,
  o.last_activity_at,
  greatest(0, floor(extract(epoch from (now() - o.last_activity_at)) / 86400))::int as days_without_movement,
  (select count(*)::int from public.submission_documents d where d.submission_id = o.submission_id) as documents_count,
  (select count(*)::int from public.missing_information m where m.opportunity_id = o.id and m.status in ('open','requested')) as missing_open_count,
  (select count(*)::int from public.quotes q where q.opportunity_id = o.id and q.quote_status in ('indicative','firm','accepted')) as quotes_count
from public.opportunities o
join public.companies c on c.id = o.company_id
left join public.insureds i on i.id = o.insured_id
left join public.user_profiles up on up.id = o.owner_profile_id
where public.can_access_company(o.company_id);

create or replace view public.pipeline_kpis_view_mt as
select
  company_id,
  count(*)::int as total,
  count(*) filter (where stage = 'intake')::int as intake,
  count(*) filter (where stage in ('submission_preparation','marketed','quoted','negotiation'))::int as en_proceso,
  count(*) filter (where stage in ('bound','documentation','invoiced','closed'))::int as ganados_o_cerrados,
  count(*) filter (where stage = 'lost')::int as perdidos,
  count(*) filter (
    where greatest(0, floor(extract(epoch from (now() - last_activity_at)) / 86400))::int > 3
      and stage not in ('closed','lost')
  )::int as sin_mov_mas_3_dias,
  count(*) filter (
    where deadline_at is not null
      and deadline_at <= now() + interval '7 days'
      and stage not in ('closed','lost')
  )::int as deadline_menos_7_dias,
  coalesce(sum(estimated_premium), 0)::numeric(18,2) as prima_estimada_total,
  coalesce(sum(brokerage_estimated), 0)::numeric(18,2) as brokerage_estimado_total,
  coalesce(sum(weighted_revenue), 0)::numeric(18,2) as revenue_ponderado_total
from public.opportunities
where public.can_access_company(company_id)
group by company_id;

-- ============================================================
-- RLS
-- ============================================================

alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.company_users enable row level security;
alter table public.insureds enable row level security;
alter table public.brokers enable row level security;
alter table public.market_contacts enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_documents enable row level security;
alter table public.opportunities enable row level security;
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
alter table public.final_documents enable row level security;
alter table public.endorsements enable row level security;
alter table public.endorsement_lines enable row level security;
alter table public.financial_documents enable row level security;

-- Markets: todos los autenticados pueden leer (global)
drop policy if exists markets_read_all on public.markets;
create policy markets_read_all on public.markets for select to authenticated using (true);

-- User profiles: ven el propio o super_admin ve todos
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles for select to authenticated
  using (auth.uid() = auth_user_id or public.is_super_admin(auth.uid()));

-- Companies
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (public.can_access_company(id));

-- Company users
drop policy if exists company_users_select on public.company_users;
create policy company_users_select on public.company_users for select to authenticated
  using (public.is_super_admin(auth.uid()) or public.can_access_company(company_id));

-- Todas las demás tablas: política tenant uniforme
do $rls$
declare
  t text;
begin
  foreach t in array array[
    'insureds','brokers','market_contacts','submissions','submission_documents',
    'opportunities','submission_markets','quotes','quote_terms',
    'generated_outputs','document_versions','missing_information',
    'tasks','activities','placements','placement_lines',
    'final_documents','endorsements','endorsement_lines','financial_documents'
  ]
  loop
    execute format('
      drop policy if exists %s_tenant_policy on public.%s;
      create policy %s_tenant_policy on public.%s
      for all to authenticated
      using (public.can_access_company(company_id))
      with check (public.can_access_company(company_id));
    ', t, t, t, t);
  end loop;
end $rls$;

commit;
