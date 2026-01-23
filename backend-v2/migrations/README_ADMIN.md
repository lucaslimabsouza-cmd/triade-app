# Modo Administrativo - Documentação

## ✅ Implementação Completa

O modo administrativo foi implementado de forma **segura e backward compatible**. Nada do código existente foi quebrado.

## 📋 O que foi implementado

### Backend
1. ✅ Campo `is_admin` na tabela `party_auth` (opcional, padrão `false`)
2. ✅ Login inclui `is_admin` no token (se for admin)
3. ✅ Middleware `requireAdmin` para proteger rotas admin
4. ✅ Rotas admin separadas (`/admin/*`)
5. ✅ Endpoints admin:
   - `GET /admin/operations/all` - Todas as operações
   - `GET /admin/parties/all` - Todos os clientes
   - `GET /admin/movements/all` - Todas as movimentações
   - `POST /admin/set-admin` - Definir/remover admin

### Mobile
1. ✅ Telas admin separadas (AdminHomeScreen, AdminOperationsScreen, etc.)
2. ✅ Navegação admin separada (AdminNavigator)
3. ✅ Navegação condicional baseada em `is_admin`
4. ✅ Login detecta admin e redireciona automaticamente

## 🚀 Como usar

### 1. Executar Migration SQL

Execute o SQL no Supabase:

```sql
-- Adicionar coluna is_admin
ALTER TABLE party_auth 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Garantir que todos sejam false
UPDATE party_auth 
SET is_admin = false 
WHERE is_admin IS NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_party_auth_is_admin ON party_auth(is_admin) WHERE is_admin = true;
```

### 2. Tornar um usuário admin

**Opção A: Via SQL direto**
```sql
UPDATE party_auth 
SET is_admin = true 
WHERE party_id = 'UUID_DO_USUARIO';
```

**Opção B: Via API (requer admin já existente)**
```bash
curl -X POST https://triade-backend.onrender.com/admin/set-admin \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "party_id": "UUID_DO_USUARIO",
    "is_admin": true
  }'
```

### 3. Testar

1. Faça login com um usuário admin
2. O app deve redirecionar automaticamente para a tela admin
3. Você verá todas as operações, clientes e movimentações sem filtros

## 🔒 Segurança

- ✅ Campo `is_admin` opcional (não quebra código existente)
- ✅ Token antigo continua válido (sem `is_admin`)
- ✅ Mobile antigo continua funcionando (ignora `is_admin`)
- ✅ Endpoints admin protegidos por `requireAdmin`
- ✅ Usuários normais não acessam rotas admin (403 Forbidden)

## 🔄 Rollback

Se algo der errado:

1. **Remover campo do banco (opcional)**:
```sql
ALTER TABLE party_auth DROP COLUMN IF EXISTS is_admin;
```

2. **Reverter código Git**:
```bash
git checkout v1.1.0-pull-to-refresh
```

3. **App antigo continua funcionando** (ignora campos novos)

## 📝 Notas

- O campo `is_admin` é opcional e tem padrão `false`
- Usuários existentes continuam funcionando normalmente
- Apenas usuários com `is_admin = true` veem a interface admin
- Todas as mudanças são backward compatible
