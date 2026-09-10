-- Atualizar tabela pacotes com colunas ordem e link_grupo
-- Executa isto no Supabase SQL Editor

-- 1. Adicionar coluna "ordem" (para ordenação dos pacotes)
ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;

-- 2. Adicionar coluna "link_grupo" (link do grupo WhatsApp/Telegram por turma)
ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS link_grupo TEXT;

-- 3. Criar índice para ordenação rápida
CREATE INDEX IF NOT EXISTS idx_pacotes_ordem ON pacotes(ordem);

-- 4. Ordenar pacotes existentes por valor (mais barato primeiro)
UPDATE pacotes SET ordem = sub.row_num - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY valor ASC) AS row_num
  FROM pacotes
) AS sub
WHERE pacotes.id = sub.id;
