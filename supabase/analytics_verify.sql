-- ============================================================
-- SCRIPT DE VERIFICAÇÃO - ANALYTICS
-- Executar no Supabase SQL Editor para verificar se tudo está ok
-- ============================================================

-- 1. Verificar se a tabela analytics_events existe
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
    RAISE NOTICE '✅ Tabela analytics_events EXISTE';
  ELSE
    RAISE WARNING '❌ Tabela analytics_events NÃO EXISTE - Execute analytics_full.sql';
  END IF;
END $$;

-- 2. Verificar colunas da tabela
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'analytics_events'
ORDER BY ordinal_position;

-- 3. Verificar RLS policies
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'analytics_events';

-- 4. Verificar funções RPC
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE 'get_analytics_%'
ORDER BY routine_name;

-- 5. Contar eventos (se tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
    RAISE NOTICE 'Total de eventos: %', (SELECT COUNT(*) FROM analytics_events);
    RAISE NOTICE 'Eventos hoje: %', (SELECT COUNT(*) FROM analytics_events WHERE created_at >= CURRENT_DATE);
    RAISE NOTICE 'Sessões únicas: %', (SELECT COUNT(DISTINCT session_id) FROM analytics_events);
  END IF;
END $$;
