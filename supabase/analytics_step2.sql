-- ============================================================
-- PASSO 2: Criar as RPCs (executar DEPOIS do Passo 1)
-- ============================================================

-- Overview
CREATE OR REPLACE FUNCTION get_analytics_overview(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  total_events BIGINT;
  unique_visitors BIGINT;
  page_views BIGINT;
  sessions BIGINT;
  avg_duration NUMERIC;
  avg_scroll NUMERIC;
  bounce_rate NUMERIC;
  new_visitors BIGINT;
  returning_visitors BIGINT;
  events_by_day JSONB;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT session_id), COUNT(*) FILTER (WHERE event_name='page_view'),
    COALESCE(AVG(session_duration_ms),0), COALESCE(AVG(scroll_depth),0)
  INTO total_events, sessions, page_views, avg_duration, avg_scroll
  FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL;

  SELECT COUNT(DISTINCT session_id) INTO unique_visitors
  FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND session_id IS NOT NULL;

  SELECT COALESCE(
    (SELECT COUNT(*) FROM (
      SELECT session_id, COUNT(*) FILTER (WHERE event_name='page_view') as pv
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY session_id HAVING COUNT(*) FILTER (WHERE event_name='page_view') = 1
    ) sub) * 100.0 / NULLIF(
      (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL), 0
    ), 0
  ) INTO bounce_rate;

  SELECT COUNT(*) INTO new_visitors FROM analytics_events
  WHERE event_name='page_view' AND is_new_visitor=true
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
  returning_visitors := GREATEST(COALESCE(unique_visitors,0) - COALESCE(new_visitors,0), 0);

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

-- Audience
CREATE OR REPLACE FUNCTION get_analytics_audience(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'devices', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(device_type, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND event_name='page_view'
      GROUP BY device_type ORDER BY COUNT(*) DESC
    ) sub),
    'browsers', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(browser, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND event_name='page_view'
      GROUP BY browser ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'os_list', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(os, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND event_name='page_view'
      GROUP BY os ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'viewports', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(viewport_width::TEXT || 'x' || viewport_height::TEXT, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND event_name='page_view' AND viewport_width IS NOT NULL
      GROUP BY viewport_width, viewport_height ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'connections', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(connection_type, 'Unknown'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND event_name='page_view'
      GROUP BY connection_type ORDER BY COUNT(*) DESC
    ) sub),
    'languages', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('name', COALESCE(language, 'pt'), 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND event_name='page_view'
      GROUP BY language ORDER BY COUNT(*) DESC LIMIT 5
    ) sub)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Acquisition
CREATE OR REPLACE FUNCTION get_analytics_acquisition(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  direct BIGINT; search BIGINT; social BIGINT; referral BIGINT;
BEGIN
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
  ), 0);

  RETURN jsonb_build_object(
    'channels', jsonb_build_object('direct', direct, 'search', search, 'social', social, 'referral', referral),
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
      FROM analytics_events WHERE event_name='page_view' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY page ORDER BY COUNT(*) DESC LIMIT 10
    ) sub)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Behavior
CREATE OR REPLACE FUNCTION get_analytics_behavior(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'event_breakdown', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('event', event_name, 'count', COUNT(*)) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY event_name ORDER BY COUNT(*) DESC
    ) sub),
    'pages_detail', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'page', page,
        'views', COUNT(*) FILTER (WHERE event_name='page_view'),
        'clicks', COUNT(*) FILTER (WHERE event_name IN ('click','cta_click','contact_click')),
        'scroll_avg', ROUND(COALESCE(AVG(scroll_depth) FILTER (WHERE scroll_depth > 0), 0))
      ) AS t
      FROM analytics_events WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND page IS NOT NULL
      GROUP BY page ORDER BY COUNT(*) FILTER (WHERE event_name='page_view') DESC LIMIT 10
    ) sub),
    'click_elements', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('element', event_data->>'text', 'tag', event_data->>'tag', 'count', COUNT(*)) AS t
      FROM analytics_events WHERE event_name IN ('click','cta_click','contact_click')
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY event_data->>'text', event_data->>'tag' ORDER BY COUNT(*) DESC LIMIT 15
    ) sub),
    'form_events', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'form', COALESCE(event_data->>'form', event_data->>'text', 'unknown'),
        'action', event_name, 'count', COUNT(*)
      ) AS t
      FROM analytics_events WHERE event_name IN ('form_submit','form_interaction','enrollment')
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY event_data->>'form', event_data->>'text', event_name ORDER BY COUNT(*) DESC
    ) sub),
    'scroll_distribution', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object('depth', scroll_depth, 'count', COUNT(*)) AS t
      FROM analytics_events WHERE event_name='scroll_depth' AND scroll_depth IS NOT NULL
        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY scroll_depth ORDER BY scroll_depth ASC
    ) sub)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Performance
CREATE OR REPLACE FUNCTION get_analytics_performance(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'errors', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'message', event_data->>'message', 'page', page,
        'source', event_data->>'source', 'count', COUNT(*)
      ) AS t
      FROM analytics_events WHERE event_name='error' AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      GROUP BY event_data->>'message', page, event_data->>'source' ORDER BY COUNT(*) DESC LIMIT 10
    ) sub),
    'error_count', (SELECT COUNT(*) FROM analytics_events
      WHERE event_name='error' AND created_at >= NOW() - (p_days || ' days')::INTERVAL),
    'web_vitals', (SELECT COALESCE(jsonb_agg(t), '[]'::JSONB) FROM (
      SELECT jsonb_build_object(
        'metric', event_data->>'metric', 'value', event_data->>'value',
        'page', page, 'date', TO_CHAR(created_at, 'YYYY-MM-DD')
      ) AS t
      FROM analytics_events WHERE event_name IN ('lcp','fid','cls','fcp','ttfb','inp')
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funnel
CREATE OR REPLACE FUNCTION get_analytics_funnel(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  step1 BIGINT; step2 BIGINT; step3 BIGINT; step4 BIGINT; step5 BIGINT;
BEGIN
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
  WHERE event_name='enrollment' AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  RETURN jsonb_build_object(
    'steps', jsonb_build_array(
      jsonb_build_object('name', 'Visita à Landing Page', 'count', COALESCE(step1,0), 'rate', 100),
      jsonb_build_object('name', 'Engajamento (25%+ scroll)', 'count', COALESCE(step2,0),
        'rate', CASE WHEN step1>0 THEN ROUND(step2*100.0/step1,1) ELSE 0 END),
      jsonb_build_object('name', 'Interage com Formulário', 'count', COALESCE(step3,0),
        'rate', CASE WHEN step1>0 THEN ROUND(step3*100.0/step1,1) ELSE 0 END),
      jsonb_build_object('name', 'Clica no CTA', 'count', COALESCE(step4,0),
        'rate', CASE WHEN step1>0 THEN ROUND(step4*100.0/step1,1) ELSE 0 END),
      jsonb_build_object('name', 'Inscrição Completa', 'count', COALESCE(step5,0),
        'rate', CASE WHEN step1>0 THEN ROUND(step5*100.0/step1,1) ELSE 0 END)
    ),
    'conversion_rate', CASE WHEN step1>0 THEN ROUND(step5*100.0/step1,1) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
