ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS hero_status_texto TEXT DEFAULT 'BREVEMENTE';

COMMENT ON COLUMN configuracoes.hero_status_texto IS 'Texto exibido no hero quando a data não está confirmada (ex: BREVEMENTE, EM BREVE, etc)';