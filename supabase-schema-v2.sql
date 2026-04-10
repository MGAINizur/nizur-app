-- ============================================================
-- NIZUR.IO — SUPABASE SCHEMA V2
-- 7 tablas + 1 bucket
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. INSUREDS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insureds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  industry TEXT,
  subcategory TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. SUBMISSIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_message_id TEXT UNIQUE,
  source_email TEXT,
  source_name TEXT,
  subject TEXT,
  email_body TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  insured_id UUID REFERENCES insureds(id),
  ramo TEXT,
  ramo_detected_confidence NUMERIC DEFAULT 0.0,
  submission_type TEXT DEFAULT 'inbound',
  currency TEXT DEFAULT 'USD',
  sum_insured NUMERIC,
  limit_amount NUMERIC,
  estimated_premium NUMERIC,
  policy_start DATE,
  policy_end DATE,
  status TEXT DEFAULT 'pending',
  raw_llm_json JSONB,
  extraction_confidence NUMERIC,
  needs_review BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. SUBMISSION_DOCUMENTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS submission_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  storage_path TEXT,
  file_size INTEGER,
  extracted_text TEXT,
  document_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. OPPORTUNITIES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id),
  insured_id UUID REFERENCES insureds(id),
  title TEXT NOT NULL,
  category TEXT,
  ramo TEXT,
  country TEXT,
  currency TEXT DEFAULT 'USD',
  limit_amount NUMERIC,
  estimated_premium NUMERIC,
  brokerage_estimated NUMERIC,
  policy_start DATE,
  policy_end DATE,
  deadline_at TIMESTAMPTZ,
  stage TEXT DEFAULT 'NUEVO' CHECK (stage IN (
    'NUEVO','EN_ANALISIS','COTIZADO','ORDEN_FIRME',
    'CERRADO_GANADO','CERRADO_PERDIDO'
  )),
  priority_score INTEGER DEFAULT 0,
  days_without_movement INTEGER DEFAULT 0,
  owner TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. GENERATED_OUTPUTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_outputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id),
  opportunity_id UUID REFERENCES opportunities(id),
  output_type TEXT CHECK (output_type IN (
    'executive_summary','missing_info_checklist',
    'slip_draft','slip_en','slip_es',
    'engineering_report','submission_property',
    'booking_worksheet','memo_interno'
  )),
  version INTEGER DEFAULT 1,
  content_markdown TEXT,
  content_json JSONB,
  storage_path TEXT,
  status TEXT DEFAULT 'draft',
  created_by TEXT DEFAULT 'jaina',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. MISSING_INFORMATION ──────────────────────────────────
CREATE TABLE IF NOT EXISTS missing_information (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id),
  field_name TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low')),
  blocks_quotation BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','waived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. ACTIVITIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID REFERENCES opportunities(id),
  submission_id UUID REFERENCES submissions(id),
  activity_type TEXT NOT NULL,
  activity_detail TEXT,
  actor TEXT DEFAULT 'jaina',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRIGGERS ────────────────────────────────────────────────

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insureds_updated BEFORE UPDATE ON insureds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER submissions_updated BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER opportunities_updated BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER missing_info_updated BEFORE UPDATE ON missing_information
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-log stage changes in activities
CREATE OR REPLACE FUNCTION log_opportunity_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage != NEW.stage THEN
    INSERT INTO activities (opportunity_id, activity_type, activity_detail, actor)
    VALUES (NEW.id, 'stage_change', OLD.stage || ' → ' || NEW.stage, 'system');
    NEW.last_activity_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunity_stage_log BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION log_opportunity_stage_change();

-- Auto-calculate priority_score
CREATE OR REPLACE FUNCTION calculate_priority_score()
RETURNS TRIGGER AS $$
DECLARE score INTEGER := 0;
BEGIN
  -- High limit = higher priority
  IF NEW.limit_amount >= 10000000 THEN score := score + 40;
  ELSIF NEW.limit_amount >= 1000000 THEN score := score + 20;
  END IF;
  -- Deadline urgency
  IF NEW.deadline_at IS NOT NULL AND NEW.deadline_at <= NOW() + INTERVAL '7 days' THEN
    score := score + 30;
  ELSIF NEW.deadline_at IS NOT NULL AND NEW.deadline_at <= NOW() + INTERVAL '30 days' THEN
    score := score + 15;
  END IF;
  -- Days without movement penalty
  IF NEW.days_without_movement > 7 THEN score := score - 10; END IF;
  NEW.priority_score := GREATEST(score, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunity_priority BEFORE INSERT OR UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION calculate_priority_score();

-- ── SAMPLE DATA ──────────────────────────────────────────────

-- Sample insured
INSERT INTO insureds (id, name, country, industry, subcategory)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Granitos de Paraguay S.A.', 'Paraguay', 'Agronegocios', 'Granos'),
  ('22222222-2222-2222-2222-222222222222', 'Edison Energy', 'Argentina', 'Energía', 'Hidroeléctrica'),
  ('33333333-3333-3333-3333-333333333333', 'Frigorífico del Sur S.A.', 'Argentina', 'Manufactura Alimentos', 'Frigorífico'),
  ('44444444-4444-4444-4444-444444444444', 'Distribuidora del Norte S.A.', 'Argentina', 'Distribución/Logística', 'Alimentos')
ON CONFLICT DO NOTHING;

-- Sample opportunities (linked to insureds)
INSERT INTO opportunities (insured_id, title, ramo, country, currency, limit_amount, estimated_premium, stage, deadline_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Granitos de Paraguay — RC General', 'RC General', 'Paraguay', 'USD', 2000000, 48500, 'COTIZADO', NOW() + INTERVAL '15 days'),
  ('22222222-2222-2222-2222-222222222222', 'Edison Energy — Alicurá + Cerros Colorados', 'Property OAR', 'Argentina', 'USD', 1000000000, NULL, 'EN_ANALISIS', NOW() + INTERVAL '30 days'),
  ('33333333-3333-3333-3333-333333333333', 'Frigorífico del Sur — RC General', 'RC General', 'Argentina', 'USD', 1000000, NULL, 'EN_ANALISIS', NULL),
  ('44444444-4444-4444-4444-444444444444', 'Distribuidora del Norte — RC General', 'RC General', 'Argentina', 'USD', 1000000, NULL, 'NUEVO', NULL)
ON CONFLICT DO NOTHING;

-- ── VIEWS ────────────────────────────────────────────────────

-- Pipeline summary view
CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE stage = 'NUEVO') as nuevos,
  COUNT(*) FILTER (WHERE stage IN ('EN_ANALISIS','COTIZADO','ORDEN_FIRME')) as en_proceso,
  COUNT(*) FILTER (WHERE stage = 'CERRADO_GANADO') as ganados,
  COUNT(*) FILTER (WHERE stage = 'CERRADO_PERDIDO') as perdidos,
  COUNT(*) FILTER (WHERE days_without_movement > 3) as alertas_movimiento,
  COUNT(*) FILTER (WHERE deadline_at <= NOW() + INTERVAL '7 days' AND stage NOT IN ('CERRADO_GANADO','CERRADO_PERDIDO')) as alertas_deadline,
  COALESCE(SUM(limit_amount) FILTER (WHERE stage NOT IN ('CERRADO_PERDIDO')), 0) as tiv_total,
  COALESCE(SUM(estimated_premium) FILTER (WHERE stage NOT IN ('CERRADO_PERDIDO')), 0) as prima_total_estimada,
  COALESCE(SUM(brokerage_estimated) FILTER (WHERE stage NOT IN ('CERRADO_PERDIDO')), 0) as brokerage_total
FROM opportunities;

-- By ramo view (for charts)
CREATE OR REPLACE VIEW pipeline_by_ramo AS
SELECT
  ramo,
  COUNT(*) as cantidad,
  COALESCE(SUM(limit_amount), 0) as tiv_total,
  COALESCE(SUM(estimated_premium), 0) as prima_total,
  COALESCE(SUM(brokerage_estimated), 0) as brokerage_total
FROM opportunities
WHERE stage NOT IN ('CERRADO_PERDIDO')
GROUP BY ramo
ORDER BY prima_total DESC;

-- ============================================================
-- STORAGE BUCKET
-- Crear manualmente en Supabase Dashboard → Storage:
-- Bucket name: submission-files
-- Public: NO (private)
-- ============================================================
