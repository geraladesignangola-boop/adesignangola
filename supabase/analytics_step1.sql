-- ============================================================
-- PASSO 1: Eliminar tabela antiga e recriar completa
-- (Os dados de analytics antigos serão perdidos, mas são Poucos)
-- ============================================================

DROP TABLE IF EXISTS analytics_events CASCADE;

CREATE TABLE analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  page TEXT,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  user_agent TEXT,
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,
  device_type TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  screen_width INTEGER,
  screen_height INTEGER,
  connection_type TEXT,
  language TEXT,
  timezone TEXT,
  session_id TEXT,
  session_duration_ms INTEGER,
  scroll_depth INTEGER,
  is_new_visitor BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ae_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_ae_event_name ON analytics_events(event_name);
CREATE INDEX idx_ae_page ON analytics_events(page);
CREATE INDEX idx_ae_session ON analytics_events(session_id);
CREATE INDEX idx_ae_utm_source ON analytics_events(utm_source);
CREATE INDEX idx_ae_browser ON analytics_events(browser);
CREATE INDEX idx_ae_os ON analytics_events(os);
CREATE INDEX idx_ae_device ON analytics_events(device_type);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_analytics" ON analytics_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "authenticated_select_analytics" ON analytics_events
  FOR SELECT TO authenticated USING (true);
