-- Adicionar coluna vagas à tabela pacotes
-- 0 = ilimitado, >0 = número máximo de inscrições aceites
ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS vagas INTEGER DEFAULT 0;
