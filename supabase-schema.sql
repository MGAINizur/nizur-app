-- ============================================================
-- NIZUR.IO — SUPABASE SCHEMA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Tabla de organizaciones (brokers)
CREATE TABLE organizaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email_contacto TEXT,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de usuarios (muchos por organización)
CREATE TABLE usuarios (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  org_id UUID REFERENCES organizaciones(id),
  nombre TEXT,
  email TEXT UNIQUE NOT NULL,
  rol TEXT DEFAULT 'broker' CHECK (rol IN ('admin', 'broker', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: crear usuario automáticamente al registrarse con magic link
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO usuarios (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Tabla principal: pipeline de negocios
CREATE TABLE negocios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizaciones(id),
  
  -- Datos del submission
  asegurado TEXT NOT NULL,
  actividad TEXT,
  ramo TEXT DEFAULT 'RC General',
  ubicacion TEXT,
  pais TEXT DEFAULT 'Argentina',
  facturacion_usd NUMERIC,
  empleados INTEGER,
  
  -- Estructura financiera
  suma_asegurada_usd NUMERIC,
  deducible_usd NUMERIC,
  prima_neta_usd NUMERIC,
  
  -- Vigencia
  vigencia_desde DATE,
  vigencia_hasta DATE,
  
  -- Pipeline
  estado TEXT DEFAULT 'NUEVO' CHECK (estado IN (
    'NUEVO', 'EN_ANALISIS', 'COTIZADO', 
    'ORDEN_FIRME', 'CERRADO_GANADO', 'CERRADO_PERDIDO'
  )),
  
  -- Metadata
  broker_origen TEXT,        -- email del broker que mandó el submission
  reasegurado TEXT,          -- aseguradora cedente
  notas TEXT,
  
  -- Control
  fecha_ingreso TIMESTAMPTZ DEFAULT NOW(),
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  dias_sin_movimiento INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM NOW() - ultima_actualizacion)::INTEGER
  ) STORED,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de documentos generados
CREATE TABLE documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('submission', 'slip', 'informe_riesgo', 'confirmacion', 'endoso', 'otro')),
  nombre TEXT NOT NULL,
  url TEXT,                  -- URL del archivo en Supabase Storage
  generado_por TEXT DEFAULT 'jaina',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de actividad / log de cambios
CREATE TABLE actividad (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  tipo TEXT,                 -- 'estado_change', 'documento_generado', 'nota', 'mail_enviado'
  descripcion TEXT,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Función para actualizar ultima_actualizacion automáticamente
CREATE OR REPLACE FUNCTION update_ultima_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_actualizacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER negocios_updated
  BEFORE UPDATE ON negocios
  FOR EACH ROW EXECUTE FUNCTION update_ultima_actualizacion();

-- Función para registrar cambios de estado en actividad
CREATE OR REPLACE FUNCTION log_estado_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado != NEW.estado THEN
    INSERT INTO actividad (negocio_id, tipo, descripcion, estado_anterior, estado_nuevo)
    VALUES (NEW.id, 'estado_change', 'Cambio de estado automático', OLD.estado, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER negocios_estado_log
  AFTER UPDATE ON negocios
  FOR EACH ROW EXECUTE FUNCTION log_estado_change();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — cada org ve solo sus datos
-- ============================================================

ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Usuarios solo ven su propia organización
CREATE POLICY "usuarios_org" ON negocios
  FOR ALL USING (
    org_id = (SELECT org_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "documentos_org" ON documentos
  FOR ALL USING (
    negocio_id IN (
      SELECT id FROM negocios 
      WHERE org_id = (SELECT org_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "actividad_org" ON actividad
  FOR ALL USING (
    negocio_id IN (
      SELECT id FROM negocios 
      WHERE org_id = (SELECT org_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- ============================================================
-- DATOS DE PRUEBA
-- ============================================================

-- Organización Ten Broking (demo)
INSERT INTO organizaciones (id, nombre, email_contacto, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Ten Broking', 'luciano@tenbroking.com', 'pro');

-- Negocios de demo
INSERT INTO negocios (org_id, asegurado, actividad, ramo, ubicacion, pais, facturacion_usd, suma_asegurada_usd, estado, broker_origen) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Granitos de Paraguay S.A.', 'Acopio y comercialización de granos', 'RC General', 'Asunción', 'Paraguay', 18000000, 2000000, 'COTIZADO', 'broker@ejemplo.com'),
  ('00000000-0000-0000-0000-000000000001', 'Frigorífico del Sur S.A.', 'Faena y distribución de carnes', 'RC General', 'Bahía Blanca', 'Argentina', 22000000, 1000000, 'EN_ANALISIS', 'mar.schlossberg@gmail.com'),
  ('00000000-0000-0000-0000-000000000001', 'Distribuidora del Norte S.A.', 'Distribución mayorista de alimentos', 'RC General', 'Tucumán', 'Argentina', 12000000, 1000000, 'NUEVO', 'broker@ejemplo.com'),
  ('00000000-0000-0000-0000-000000000001', 'Arcor S.A.I.C.', 'Producción de alimentos masivos', 'Product Recall / CPI', 'Arroyito, Córdoba', 'Argentina', 625000000, 10000000, 'ORDEN_FIRME', 'luciano@tenbroking.com');

-- ============================================================
-- STORAGE BUCKET para documentos
-- ============================================================
-- Ejecutar esto por separado en Supabase Dashboard → Storage:
-- 1. Crear bucket "documentos" (privado)
-- 2. Policy: solo usuarios autenticados de la misma org pueden acceder

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

CREATE VIEW pipeline_resumen AS
SELECT 
  o.nombre as organizacion,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE n.estado = 'NUEVO') as nuevos,
  COUNT(*) FILTER (WHERE n.estado IN ('EN_ANALISIS', 'COTIZADO', 'ORDEN_FIRME')) as en_proceso,
  COUNT(*) FILTER (WHERE n.estado = 'CERRADO_GANADO') as cerrados_ganados,
  COUNT(*) FILTER (WHERE n.dias_sin_movimiento > 3) as alertas,
  SUM(n.suma_asegurada_usd) FILTER (WHERE n.estado NOT IN ('CERRADO_PERDIDO')) as suma_asegurada_total
FROM negocios n
JOIN organizaciones o ON n.org_id = o.id
GROUP BY o.id, o.nombre;
