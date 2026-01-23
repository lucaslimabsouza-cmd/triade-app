-- Migration: Adicionar campo is_admin na tabela party_auth
-- Data: 2026-01-23
-- Descrição: Adiciona campo is_admin para permitir modo administrativo
-- Segurança: Campo opcional com padrão false, não quebra código existente

-- Adicionar coluna se não existir (PostgreSQL)
ALTER TABLE party_auth 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Garantir que todos os registros existentes sejam false (segurança)
UPDATE party_auth 
SET is_admin = false 
WHERE is_admin IS NULL;

-- Criar índice para melhor performance em consultas admin
CREATE INDEX IF NOT EXISTS idx_party_auth_is_admin ON party_auth(is_admin) WHERE is_admin = true;

-- Comentário na coluna
COMMENT ON COLUMN party_auth.is_admin IS 'Indica se o usuário tem permissões administrativas';
