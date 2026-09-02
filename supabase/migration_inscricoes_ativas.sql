-- Execute este script para atualizar uma base que ja executou migration.sql.
ALTER TABLE public.configuracoes
    ADD COLUMN IF NOT EXISTS inscricoes_ativas BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.inscricoes_estao_ativas()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT inscricoes_ativas FROM public.configuracoes LIMIT 1), true);
$$;

REVOKE ALL ON FUNCTION public.inscricoes_estao_ativas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inscricoes_estao_ativas() TO anon, authenticated;

DROP POLICY IF EXISTS "Qualquer pessoa pode criar inscricao" ON public.inscricoes;
CREATE POLICY "Qualquer pessoa pode criar inscricao"
    ON public.inscricoes FOR INSERT
    WITH CHECK (public.inscricoes_estao_ativas());

CREATE OR REPLACE FUNCTION public.definir_inscricoes_ativas(p_ativas BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    estado BOOLEAN;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.utilizadores
        WHERE id = auth.uid()
          AND role = 'admin'
          AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar o estado das inscricoes';
    END IF;

    UPDATE public.configuracoes
    SET inscricoes_ativas = p_ativas
    WHERE id = (SELECT id FROM public.configuracoes ORDER BY criado_em LIMIT 1)
    RETURNING inscricoes_ativas INTO estado;

    IF estado IS NULL THEN
        RAISE EXCEPTION 'Configuracao do curso nao encontrada';
    END IF;

    RETURN estado;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_inscricoes_ativas(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_inscricoes_ativas(BOOLEAN) TO authenticated;