-- ============================================================
-- SCRIPT SQL PARA SUPABASE - FUNCIONALIDADE DE RESET
-- ============================================================
-- Executar no Supabase SQL Editor
--
-- O QUE É APAGADO:
--   - inscricoes (todas)
--   - presencas_registos (todos)
--   - presencas_sessoes (todas)
--
-- O QUE NÃO É APAGADO (mantido):
--   - pacotes (pacotes do curso)
--   - modulos_curso (módulos do curso)
--   - codigos_parceria (parcerias)
--   - configuracoes (definições do sistema)
--   - utilizadores (contas de admin)
-- ============================================================

-- 1. Garantir RLS habilitado nas tabelas
ALTER TABLE IF EXISTS inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS presencas_registos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS presencas_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS codigos_parceria ENABLE ROW LEVEL SECURITY;

-- 2. Políticas DELETE para admins (usando is_admin())
DROP POLICY IF EXISTS "Admins can delete inscricoes" ON inscricoes;
CREATE POLICY "Admins can delete inscricoes" ON inscricoes
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete presencas_registos" ON presencas_registos;
CREATE POLICY "Admins can delete presencas_registos" ON presencas_registos
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete presencas_sessoes" ON presencas_sessoes;
CREATE POLICY "Admins can delete presencas_sessoes" ON presencas_sessoes
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete pacotes" ON pacotes;
CREATE POLICY "Admins can delete pacotes" ON pacotes
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete codigos_parceria" ON codigos_parceria;
CREATE POLICY "Admins can delete codigos_parceria" ON codigos_parceria
  FOR DELETE USING (public.is_admin());

-- 3. Função RPC: reset total de dados
-- APAGA: inscrições, presenças, sessões, pacotes, módulos, parcerias
-- NÃO APAGA: configurações, utilizadores
-- SEGURANÇA: Apenas admins podem executar
CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem apagar todos os dados';
  END IF;
  TRUNCATE TABLE presencas_registos CASCADE;
  TRUNCATE TABLE presencas_sessoes CASCADE;
  TRUNCATE TABLE inscricoes CASCADE;
  TRUNCATE TABLE modulos_curso CASCADE;
  TRUNCATE TABLE pacotes CASCADE;
  TRUNCATE TABLE codigos_parceria CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Restringir acesso: apenas autenticados, e is_admin() verifica no corpo
REVOKE ALL ON FUNCTION reset_all_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_all_data() TO authenticated;

-- 3.1 Função RPC: apagar todos os dados dos inscritos
-- APAGA: inscrições, presenças, sessões, notificações de inscritos
-- NÃO APAGA: pacotes, módulos, parcerias, configurações, utilizadores
-- SEGURANÇA: Apenas admins podem executar
CREATE OR REPLACE FUNCTION reset_inscritos_data()
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem apagar dados dos inscritos';
  END IF;
  TRUNCATE TABLE presencas_registos CASCADE;
  TRUNCATE TABLE presencas_sessoes CASCADE;
  TRUNCATE TABLE inscricoes CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Restringir acesso: apenas autenticados
REVOKE ALL ON FUNCTION reset_inscritos_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_inscritos_data() TO authenticated;

-- 4. Função RPC: validar código de parceria (formato JSONB original)
DROP FUNCTION IF EXISTS validar_codigo_parceria(TEXT);
CREATE OR REPLACE FUNCTION validar_codigo_parceria(p_codigo TEXT)
RETURNS JSONB AS $$
DECLARE
    reg codigos_parceria%ROWTYPE;
BEGIN
    SELECT * INTO reg FROM codigos_parceria
    WHERE codigo = p_codigo AND ativo = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valido', false);
    END IF;

    IF reg.limite_usos IS NOT NULL AND reg.usos_atuais >= reg.limite_usos THEN
        RETURN jsonb_build_object('valido', false);
    END IF;

    RETURN jsonb_build_object('valido', true, 'percentual', reg.percentual_desconto);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Função RPC: consultar inscrição pública
DROP FUNCTION IF EXISTS consultar_inscricao_publica(TEXT);
CREATE OR REPLACE FUNCTION consultar_inscricao_publica(codigo TEXT)
RETURNS TABLE(
  id UUID,
  nome_completo TEXT,
  estado TEXT,
  perfil TEXT,
  perfil_label TEXT,
  modalidade_pagamento TEXT,
  codigo_conclusao TEXT,
  data_inscricao TIMESTAMPTZ,
  data_confirmacao TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.nome_completo,
    i.estado,
    i.perfil,
    i.perfil_label,
    i.modalidade_pagamento,
    i.codigo_conclusao,
    i.data_inscricao,
    i.data_confirmacao
  FROM inscricoes i
  WHERE i.codigo_referencia = UPPER(TRIM(codigo));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Função RPC: definir inscrições ativas
DROP FUNCTION IF EXISTS definir_inscricoes_ativas(BOOLEAN);
CREATE OR REPLACE FUNCTION definir_inscricoes_ativas(p_ativas BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE configuracoes SET inscricoes_ativas = p_ativas WHERE id = (SELECT id FROM configuracoes LIMIT 1);
  RETURN p_ativas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Atualizar CHECK constraint da tabela pacotes (permitir slugs livres)
ALTER TABLE pacotes DROP CONSTRAINT IF EXISTS pacotes_slug_check;
ALTER TABLE pacotes ADD CONSTRAINT pacotes_slug_check CHECK (length(slug) > 0);

-- 8. Índices para performance
CREATE INDEX IF NOT EXISTS idx_inscricoes_codigo ON inscricoes(codigo_referencia);
CREATE INDEX IF NOT EXISTS idx_codigos_parceria_codigo ON codigos_parceria(codigo);
