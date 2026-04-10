
-- Supabase / PostgreSQL schema for broker pipeline
-- Focus: insureds, submissions, documents, opportunities, outputs, missing info, activities
-- Includes helper enums, triggers, indexes, views, and a storage bucket reference.

begin;

-- Extensions
create extension if not exists pgcrypto;

-- =========
-- ENUMS
-- =========

do $$
begin
  if not exists (select 1 from pg_type where typname = 'opportunity_stage') then
    create type public.opportunity_stage as enum (
      'new',
      'in_review',
      'quoted',
      'bound',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum (
      'received',
      'processing',
      'parsed',
      'needs_review',
      'linked',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'generated_output_type') then
    create type public.generated_output_type as enum (
      'executive_summary',
      'missing_info_checklist',
      'slip_draft',
      'underwriting_summary',
      'engineering_summary',
      'email_draft',
      'quote_comparison'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'generated_output_status') then
    create type public.generated_output_status as enum (
      'draft',
      'final',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'missing_info_severity') then
    create type public.missing_info_severity as enum (
      'low',
      'medium',
      'high',
      'critical'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'missing_info_status') then
    create type public.missing_info_status as enum (
      'open',
      'requested',
      'received',
      'waived',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type public.document_type as enum (
      'submission_email',
      'slip',
      'engineering_report',
      'loss_record',
      'sov',
      'financials',
      'claims_history',
      'inspection_report',
      'quote',
      'policy_wording',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_type') then
    create type public.activity_type as enum (
      'submission_received',
      'submission_parsed',
      'document_uploaded',
      'opportunity_created',
      'stage_changed',
      'missing_info_added',
      'missing_info_resolved',
      'output_generated',
      'note_added',
      'email_sent',
      'quote_received',
      'bound',
      'closed'
    );
  end if;
end $$;

-- =========
-- HELPERS
-- =========

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========
-- TABLES
-- =========

create table if not exists public.insureds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  industry text,
  subcategory text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insureds_name_country_uidx
  on public.insureds (lower(name), coalesce(lower(country), ''));

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  email_message_id text unique,
  source_email text,
  source_name text,
  subject text,
  email_body text,
  received_at timestamptz not null default now(),
  insured_id uuid references public.insureds(id) on delete set null,
  ramo text,
  submission_type text,
  currency text,
  sum_insured numeric(18,2),
  limit_amount numeric(18,2),
  estimated_premium numeric(18,2),
  policy_start date,
  policy_end date,
  status public.submission_status not null default 'received',
  raw_llm_json jsonb not null default '{}'::jsonb,
  extraction_confidence numeric(5,2),
  needs_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_received_at_idx on public.submissions(received_at desc);
create index if not exists submissions_insured_id_idx on public.submissions(insured_id);
create index if not exists submissions_status_idx on public.submissions(status);
create index if not exists submissions_ramo_idx on public.submissions(ramo);

create table if not exists public.submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  file_name text not null,
  mime_type text,
  storage_path text not null,
  file_size integer,
  extracted_text text,
  document_type public.document_type not null default 'other',
  created_at timestamptz not null default now()
);

create index if not exists submission_documents_submission_id_idx
  on public.submission_documents(submission_id);

create index if not exists submission_documents_document_type_idx
  on public.submission_documents(document_type);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  insured_id uuid references public.insureds(id) on delete set null,
  title text not null,
  category text,
  ramo text,
  country text,
  currency text,
  limit_amount numeric(18,2),
  estimated_premium numeric(18,2),
  brokerage_estimated numeric(18,2),
  policy_start date,
  policy_end date,
  deadline_at timestamptz,
  stage public.opportunity_stage not null default 'new',
  priority_score integer not null default 0 check (priority_score >= 0),
  days_without_movement integer not null default 0 check (days_without_movement >= 0),
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create unique index if not exists opportunities_submission_uidx
  on public.opportunities(submission_id);

create index if not exists opportunities_stage_idx on public.opportunities(stage);
create index if not exists opportunities_owner_idx on public.opportunities(owner);
create index if not exists opportunities_deadline_idx on public.opportunities(deadline_at);
create index if not exists opportunities_last_activity_idx on public.opportunities(last_activity_at desc);
create index if not exists opportunities_insured_id_idx on public.opportunities(insured_id);
create index if not exists opportunities_ramo_idx on public.opportunities(ramo);

create table if not exists public.generated_outputs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  output_type public.generated_output_type not null,
  version integer not null default 1 check (version > 0),
  content_markdown text not null,
  content_json jsonb,
  status public.generated_output_status not null default 'draft',
  created_by text not null default 'jaina',
  created_at timestamptz not null default now(),
  constraint generated_outputs_parent_chk
    check (submission_id is not null or opportunity_id is not null)
);

create index if not exists generated_outputs_submission_id_idx
  on public.generated_outputs(submission_id);
create index if not exists generated_outputs_opportunity_id_idx
  on public.generated_outputs(opportunity_id);
create index if not exists generated_outputs_output_type_idx
  on public.generated_outputs(output_type);

create unique index if not exists generated_outputs_version_uidx
  on public.generated_outputs(
    coalesce(submission_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(opportunity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    output_type,
    version
  );

create table if not exists public.missing_information (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  field_name text not null,
  description text not null,
  severity public.missing_info_severity not null default 'medium',
  blocks_quotation boolean not null default false,
  status public.missing_info_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missing_information_parent_chk
    check (submission_id is not null or opportunity_id is not null)
);

create index if not exists missing_information_submission_id_idx
  on public.missing_information(submission_id);
create index if not exists missing_information_opportunity_id_idx
  on public.missing_information(opportunity_id);
create index if not exists missing_information_status_idx
  on public.missing_information(status);
create index if not exists missing_information_severity_idx
  on public.missing_information(severity);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete set null,
  activity_type public.activity_type not null,
  activity_detail text,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activities_parent_chk
    check (opportunity_id is not null or submission_id is not null)
);

create index if not exists activities_opportunity_id_idx
  on public.activities(opportunity_id, created_at desc);
create index if not exists activities_submission_id_idx
  on public.activities(submission_id, created_at desc);
create index if not exists activities_type_idx
  on public.activities(activity_type);

-- =========
-- TRIGGERS
-- =========

drop trigger if exists trg_insureds_updated_at on public.insureds;
create trigger trg_insureds_updated_at
before update on public.insureds
for each row execute function public.set_updated_at();

drop trigger if exists trg_submissions_updated_at on public.submissions;
create trigger trg_submissions_updated_at
before update on public.submissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_opportunities_updated_at on public.opportunities;
create trigger trg_opportunities_updated_at
before update on public.opportunities
for each row execute function public.set_updated_at();

drop trigger if exists trg_missing_information_updated_at on public.missing_information;
create trigger trg_missing_information_updated_at
before update on public.missing_information
for each row execute function public.set_updated_at();

-- Keep opportunity activity stamps fresh
create or replace function public.touch_opportunity_activity()
returns trigger
language plpgsql
as $$
begin
  if new.opportunity_id is not null then
    update public.opportunities
       set last_activity_at = new.created_at,
           updated_at = now(),
           days_without_movement = 0
     where id = new.opportunity_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activities_touch_opportunity on public.activities;
create trigger trg_activities_touch_opportunity
after insert on public.activities
for each row execute function public.touch_opportunity_activity();

-- =========
-- STORAGE BUCKET
-- =========
-- Run only if using Supabase Storage and role has permission.
insert into storage.buckets (id, name, public)
values ('submission-files', 'submission-files', false)
on conflict (id) do nothing;

-- =========
-- HELPER VIEWS
-- =========

create or replace view public.pipeline_dashboard_view as
select
  o.id,
  o.title,
  o.category,
  o.ramo,
  coalesce(i.name, o.title) as insured_name,
  coalesce(o.country, i.country) as country,
  o.currency,
  o.limit_amount,
  o.estimated_premium,
  o.brokerage_estimated,
  o.policy_start,
  o.policy_end,
  o.deadline_at,
  o.stage,
  o.priority_score,
  o.owner,
  o.created_at,
  o.updated_at,
  o.last_activity_at,
  greatest(0, floor(extract(epoch from (now() - o.last_activity_at)) / 86400))::int as days_without_movement_live,
  case
    when o.deadline_at is null then null
    else greatest(0, floor(extract(epoch from (o.deadline_at - now())) / 86400))::int
  end as days_to_deadline
from public.opportunities o
left join public.insureds i on i.id = o.insured_id;

create or replace view public.pipeline_kpis_view as
select
  count(*)::int as total,
  count(*) filter (where stage = 'new')::int as nuevos,
  count(*) filter (where stage = 'in_review')::int as en_proceso,
  count(*) filter (where stage = 'bound')::int as ganados,
  count(*) filter (
    where greatest(0, floor(extract(epoch from (now() - last_activity_at)) / 86400))::int > 3
      and stage not in ('bound', 'closed')
  )::int as sin_mov_mas_3_dias,
  count(*) filter (
    where deadline_at is not null
      and deadline_at <= now() + interval '7 day'
      and stage not in ('bound', 'closed')
  )::int as deadline_menos_7_dias,
  coalesce(sum(estimated_premium), 0)::numeric(18,2) as prima_estimada_total,
  coalesce(sum(brokerage_estimated), 0)::numeric(18,2) as brokerage_estimado_total
from public.opportunities;

-- =========
-- OPTIONAL RLS BASELINE
-- =========
-- Uncomment if you want RLS enabled from day one.
-- alter table public.insureds enable row level security;
-- alter table public.submissions enable row level security;
-- alter table public.submission_documents enable row level security;
-- alter table public.opportunities enable row level security;
-- alter table public.generated_outputs enable row level security;
-- alter table public.missing_information enable row level security;
-- alter table public.activities enable row level security;

commit;
