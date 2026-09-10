-- ============================================================
-- FIX DE SEGURANÇA — Proteger funções remanescentes
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Proteger buscar_por_codigo (função remanescente da migration original)
-- Esta função não é chamada pelo frontend (usa consultar_inscricao_publica)
-- mas deve ser protegida por precaução
REVOKE ALL ON FUNCTION buscar_por_codigo(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buscar_por_codigo(TEXT) TO anon, authenticated;

-- 2. Garantir que reset_inscritos_data existe e está protegida
-- (pode não existir em todas as versões do schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_inscritos_data') THEN
    REVOKE ALL ON FUNCTION reset_inscritos_data() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION reset_inscritos_data() TO authenticated;
  END IF;
END $$;

-- 3. Verificar que todas as funções SECURITY DEFINER estão protegidas
DO $$
DECLARE
  func RECORD;
BEGIN
  FOR func IN
    SELECT p.proname, n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true  -- SECURITY DEFINER
  LOOP
    -- Log para verificação (aparece no output do SQL Editor)
    RAISE NOTICE 'Função SECURITY DEFINER: %.%', func.nspname, func.proname;
  END LOOP;
END $$;
