-- ============================================================
-- MIGRAÇÃO: Adicionar colunas em falta à tabela analytics_events
-- Execute no Supabase SQL Editor SE já criaste a tabela antes
-- ============================================================

-- Adicionar colunas que podem não existir
DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS page_title TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS utm_source TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS utm_medium TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS utm_content TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS utm_term TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS browser TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS browser_version TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS os TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS os_version TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS device_type TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS viewport_width INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS viewport_height INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS screen_width INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS screen_height INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS connection_type TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS language TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS timezone TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS session_duration_ms INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS scroll_depth INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS is_new_visitor BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Adicionar índices (ignorar se já existirem)
CREATE INDEX IF NOT EXISTS idx_ae_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ae_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_ae_page ON analytics_events(page);
CREATE INDEX IF NOT EXISTS idx_ae_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ae_utm_source ON analytics_events(utm_source);
CREATE INDEX IF NOT EXISTS idx_ae_browser ON analytics_events(browser);
CREATE INDEX IF NOT EXISTS idx_ae_os ON analytics_events(os);
CREATE INDEX IF NOT EXISTS idx_ae_device ON analytics_events(device_type);

-- RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_analytics" ON analytics_events;
CREATE POLICY "anon_insert_analytics" ON analytics_events
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_analytics" ON analytics_events;
CREATE POLICY "authenticated_select_analytics" ON analytics_events
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- NOTA: Depois de executar esta migração, crea as RPCs do
-- ficheiro analytics_setup.sql (apenas as FUNCTIONS, não a tabela)
-- ============================================================
