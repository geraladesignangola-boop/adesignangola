-- ============================================================
-- ANALYTICS SETUP — Versão Completa
-- Execute no Supabase SQL Editor
-- ============================================================

-- Se a tabela NÃO existe, cria com todas as colunas
-- Se JÁ existe, executa primeiro analytics_migration.sql
CREATE TABLE IF NOT EXISTS analytics_events (
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

-- Índices
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
-- RPC: Dashboard Overview
-- ============================================================
CREATE OR REPLACE FUNCTION get_analytics_overview(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  prev_result JSONB;
  total_events BIGINT;
  prev_events BIGINT;
  unique_visitors BIGINT;
  prev_visitors BIGINT;
  page_views BIGINT;
  prev_pageviews BIGINT;
  sessions BIGINT;
  prev_sessions BIGINT;
  avg_duration NUMERIC;
  prev_avg_duration NUMERIC;
  avg_scroll NUMERIC;
  bounce_rate NUMERIC;
  new_visitors BIGINT;
  returning_visitors BIGINT;
  events_by_day JSONB;
  prev_events_by_day JSONB;
BEGIN
  -- Current period
  SELECT COUNT(*), COUNT(DISTINCT session_id), COUNT(*) FILTER (WHERE event_name='page_view'),
    COALESCE(AVG(session_duration_ms),0), COALESCE(AVG(scroll_depth),0)
  INTO total_events, sessions, page_views, avg_duration, avg_scroll
  FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL;

  SELECT COUNT(DISTINCT session_id) INTO unique_visitors
  FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND session_id IS NOT NULL;

  -- Bounce: sessions with only 1 page_view
  SELECT COALESCE(
    (SELECT COUNT(*) FILTER (WHERE single = 1) FROM (
      SELECT session_id, COUNT(*) FILTER (WHERE event_name='page_view') as single
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY session_id
    ) sub) * 100.0 / NULLIF(sessions, 0), 0
  ) INTO bounce_rate;

  -- New vs returning
  SELECT COUNT(*) INTO new_visitors FROM analytics_events
  WHERE event_name='page_view' AND is_new_visitor=true
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
  returning_visitors := GREATEST(unique_visitors - new_visitors, 0);

  -- Events by day
  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'date'), '[]'::JSONB) INTO events_by_day
  FROM (
    SELECT jsonb_build_object('date', TO_CHAR(created_at, 'YYYY-MM-DD'), 'events', COUNT(*),
      'page_views', COUNT(*) FILTER (WHERE event_name='page_view'),
      'visitors', COUNT(DISTINCT session_id)
    ) AS t
    FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
  ) sub;

  result := jsonb_build_object(
    'total_events', total_events,
    'unique_visitors', COALESCE(unique_visitors, 0),
    'page_views', page_views,
    'sessions', COALESCE(sessions, 0),
    'avg_duration_ms', ROUND(avg_duration),
    'avg_scroll_depth', ROUND(avg_scroll),
    'bounce_rate', ROUND(bounce_rate, 1),
    'new_visitors', COALESCE(new_visitors, 0),
    'returning_visitors', returning_visitors,
    'events_by_day', events_by_day,
    'period_days', p_days
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Audience (devices, browsers, OS, viewport, connection)
-- ============================================================
CREATE OR REPLACE FUNCTION get_analytics_audience(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  result := jsonb_build_object(
    'devices', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(device_type, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
        AND event_name='page_view'
      GROUP BY device_type ORDER BY COUNT(*) DESC
    ) sub),
    'browsers', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(browser, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
        AND event_name='page_view'
      GROUP BY browser ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'os_list', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(os, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
        AND event_name='page_view'
      GROUP BY os ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'viewports', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(viewport_width::TEXT || 'x' || viewport_height::TEXT, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
        AND event_name='page_view' AND viewport_width IS NOT NULL
      GROUP BY viewport_width, viewport_height ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'connections', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(connection_type, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
        AND event_name='page_view'
      GROUP BY connection_type ORDER BY COUNT(*) DESC
    ) sub),
    'languages', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(language, 'pt'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
        AND event_name='page_view'
      GROUP BY language ORDER BY COUNT(*) DESC LIMIT 5
    ) sub)
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Acquisition (UTM, referrers, entry pages)
-- ============================================================
CREATE OR REPLACE FUNCTION get_analytics_acquisition(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  direct BIGINT;
  search BIGINT;
  social BIGINT;
  referral BIGINT;
BEGIN
  -- Traffic channels
  SELECT COUNT(*) INTO direct FROM analytics_events
  WHERE event_name='page_view' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND (referrer IS NULL OR referrer = '' OR referrer LIKE '%aacademy.ao%');

  SELECT COUNT(*) INTO search FROM analytics_events
  WHERE event_name='page_view' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND (referrer ILIKE '%google%' OR referrer ILIKE '%bing%' OR referrer ILIKE '%yahoo%'
         OR referrer ILIKE '%duckduckgo%' OR referrer ILIKE '%search%');

  SELECT COUNT(*) INTO social FROM analytics_events
  WHERE event_name='page_view' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND (referrer ILIKE '%facebook%' OR referrer ILIKE '%instagram%' OR referrer ILIKE '%twitter%'
         OR referrer ILIKE '%linkedin%' OR referrer ILIKE '%tiktok%' OR referrer ILIKE '%youtube%'
         OR referrer ILIKE '%whatsapp%' OR referrer ILIKE '%telegram%');

  referral := GREATEST((SELECT COUNT(*) FROM analytics_events
    WHERE event_name='page_view' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      AND referrer IS NOT NULL AND referrer != ''
      AND referrer NOT LIKE '%aacademy.ao%'
      AND referrer NOT ILIKE '%google%' AND referrer NOT ILIKE '%bing%'
      AND referrer NOT ILIKE '%facebook%' AND referrer NOT ILIKE '%instagram%'
      AND referrer NOT ILIKE '%twitter%' AND referrer NOT ILIKE '%linkedin%'
      AND referrer NOT ILIKE '%tiktok%' AND referrer NOT ILIKE '%youtube%'
      AND referrer NOT ILIKE '%whatsapp%' AND referrer NOT ILIKE '%telegram%'
  ) - 0, 0);

  result := jsonb_build_object(
    'channels', jsonb_build_object(
      'direct', direct,
      'search', search,
      'social', social,
      'referral', referral
    ),
    'utm_sources', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(utm_source, 'Direct'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE event_name='page_view' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY utm_source ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'utm_mediums', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(utm_medium, 'none'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE event_name='page_view' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY utm_medium ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'utm_campaigns', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(utm_campaign, 'none'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE event_name='page_view' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY utm_campaign ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'referrers', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(referrer, 'Direct'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE event_name='page_view' AND referrer IS NOT NULL AND referrer != ''
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY referrer ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'landing_pages', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('page', page, 'count', COUNT(*)) AS t
      FROM analytics_events WHERE event_name='page_view'
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY page ORDER BY COUNT(*) DESC LIMIT 10
    ) sub)
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Behavior (events, clicks, forms, scroll, engagement)
-- ============================================================
CREATE OR REPLACE FUNCTION get_analytics_behavior(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  result := jsonb_build_object(
    'event_breakdown', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('event', event_name, 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY event_name ORDER BY COUNT(*) DESC
    ) sub),
    'pages_detail', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'page', page,
        'views', COUNT(*) FILTER (WHERE event_name='page_view'),
        'clicks', COUNT(*) FILTER (WHERE event_name='click' OR event_name='cta_click' OR event_name='contact_click'),
        'scroll_avg', ROUND(AVG(scroll_depth) FILTER (WHERE scroll_depth > 0))
      ) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
        AND page IS NOT NULL
      GROUP BY page ORDER BY COUNT(*) FILTER (WHERE event_name='page_view') DESC LIMIT 10
    ) sub),
    'click_elements', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'element', event_data->>'text',
        'tag', event_data->>'tag',
        'count', COUNT(*)
      ) AS t
      FROM analytics_events WHERE event_name IN ('click', 'cta_click', 'contact_click')
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY event_data->>'text', event_data->>'tag'
      ORDER BY COUNT(*) DESC LIMIT 15
    ) sub),
    'form_events', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'form', COALESCE(event_data->>'form', event_data->>'text', 'unknown'),
        'action', event_name,
        'count', COUNT(*)
      ) AS t
      FROM analytics_events WHERE event_name IN ('form_submit', 'form_interaction', 'enrollment')
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY event_data->>'form', event_data->>'text', event_name
      ORDER BY COUNT(*) DESC
    ) sub),
    'scroll_distribution', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('depth', scroll_depth, 'count', COUNT(*)) AS t
      FROM analytics_events WHERE event_name='scroll_depth' AND scroll_depth IS NOT NULL
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY scroll_depth ORDER BY scroll_depth ASC
    ) sub)
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Performance (load times, errors, Core Web Vitals)
-- ============================================================
CREATE OR REPLACE FUNCTION get_analytics_performance(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  result := jsonb_build_object(
    'errors', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'message', event_data->>'message',
        'page', page,
        'source', event_data->>'source',
        'count', COUNT(*)
      ) AS t
      FROM analytics_events WHERE event_name='error'
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY event_data->>'message', page, event_data->>'source'
      ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'error_count', (SELECT COUNT(*) FROM analytics_events
      WHERE event_name='error' AND created_at >= NOW() - (p_days || ' days')::INTERVAL),
    'web_vitals', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'metric', event_data->>'metric',
        'value', event_data->>'value',
        'page', page,
        'date', TO_CHAR(created_at, 'YYYY-MM-DD')
      ) AS t
      FROM analytics_events WHERE event_name IN ('lcp', 'fid', 'cls', 'fcp', 'ttfb', 'inp')
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      ORDER BY created_at DESC LIMIT 50
    ) sub),
    'performance_summary', (SELECT jsonb_build_object(
      'lcp_avg', (SELECT ROUND(AVG((event_data->>'value')::NUMERIC)) FROM analytics_events
        WHERE event_name='lcp' AND created_at >= NOW() - (p_days || ' days')::INTERVAL),
      'cls_avg', (SELECT ROUND(AVG((event_data->>'value')::NUMERIC), 3) FROM analytics_events
        WHERE event_name='cls' AND created_at >= NOW() - (p_days || ' days')::INTERVAL),
      'fcp_avg', (SELECT ROUND(AVG((event_data->>'value')::NUMERIC)) FROM analytics_events
        WHERE event_name='fcp' AND created_at >= NOW() - (p_days || ' days')::INTERVAL),
      'ttfb_avg', (SELECT ROUND(AVG((event_data->>'value')::NUMERIC)) FROM analytics_events
        WHERE event_name='ttfb' AND created_at >= NOW() - (p_days || ' days')::INTERVAL),
      'total_errors', (SELECT COUNT(*) FROM analytics_events
        WHERE event_name='error' AND created_at >= NOW() - (p_days || ' days')::INTERVAL)
    ))
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Funnel (visit → scroll → form → submit → enrollment)
-- ============================================================
CREATE OR REPLACE FUNCTION get_analytics_funnel(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  step1 BIGINT; step2 BIGINT; step3 BIGINT; step4 BIGINT; step5 BIGINT;
BEGIN
  -- Unique sessions at each funnel step
  SELECT COUNT(DISTINCT session_id) INTO step1 FROM analytics_events
  WHERE event_name='page_view' AND page='/' AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  SELECT COUNT(DISTINCT session_id) INTO step2 FROM analytics_events
  WHERE event_name='scroll_depth' AND scroll_depth >= 25 AND page='/'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  SELECT COUNT(DISTINCT session_id) INTO step3 FROM analytics_events
  WHERE event_name='form_interaction' AND page='/'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  SELECT COUNT(DISTINCT session_id) INTO step4 FROM analytics_events
  WHERE event_name='cta_click' AND page='/'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  SELECT COUNT(DISTINCT session_id) INTO step5 FROM analytics_events
  WHERE event_name='enrollment'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  result := jsonb_build_object(
    'steps', jsonb_build_array(
      jsonb_build_object('name', 'Visita à Landing Page', 'count', COALESCE(step1, 0), 'rate', 100),
      jsonb_build_object('name', 'Engajamento (25%+ scroll)', 'count', COALESCE(step2, 0),
        'rate', CASE WHEN step1 > 0 THEN ROUND(step2 * 100.0 / step1, 1) ELSE 0 END),
      jsonb_build_object('name', 'Interage com Formulário', 'count', COALESCE(step3, 0),
        'rate', CASE WHEN step1 > 0 THEN ROUND(step3 * 100.0 / step1, 1) ELSE 0 END),
      jsonb_build_object('name', 'Clica no CTA', 'count', COALESCE(step4, 0),
        'rate', CASE WHEN step1 > 0 THEN ROUND(step4 * 100.0 / step1, 1) ELSE 0 END),
      jsonb_build_object('name', 'Inscrição Completa', 'count', COALESCE(step5, 0),
        'rate', CASE WHEN step1 > 0 THEN ROUND(step5 * 100.0 / step1, 1) ELSE 0 END)
    ),
    'conversion_rate', CASE WHEN step1 > 0 THEN ROUND(step5 * 100.0 / step1, 1) ELSE 0 END
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
