# Lead Capture — Fundação

Base do SaaS de captura de leads com autenticação JWT.

## Stack

- **Frontend:** React + Vite + React Router + Axios
- **Backend:** Node.js + Express + Knex (query builder) + MySQL
- **Auth:** JWT + bcrypt
- **Validação:** Zod

## Estrutura

```
lead-capture/
├── backend/          # API Express
├── frontend/         # App React (Vite)
├── database/         # SQL: create_database + migrations
└── scripts/          # migrate.js e seed.js
```

## Pré-requisitos

- Node.js 20+
- MySQL 8+

## 1. Instalar dependências

Na raiz do projeto:

```bash
npm run install:all
```

Ou manualmente:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

## 2. Configurar variáveis de ambiente

### Backend

```bash
cp backend/.env.example backend/.env
```

Preencha:

```
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=seu_usuario
DATABASE_PASSWORD=sua_senha
DATABASE_NAME=lead_capture

JWT_SECRET=uma_chave_segura_com_16+_chars
JWT_EXPIRES_IN=1d

APP_PORT=3001
```

> Não coloque email/senha de admin ou master no `.env`.

### Frontend

```bash
cp frontend/.env.example frontend/.env
```

```
VITE_API_URL=http://localhost:3001
```

## 3. Criar o banco

Execute o SQL:

```bash
mysql -u seu_usuario -p < database/create_database.sql
```

Isso cria o database `lead_capture` com `utf8mb4`.

## 4. Rodar migrations

Na raiz:

```bash
npm run migrate
```

Aplica, em ordem:

1. `001_create_roles_table.sql`
2. `002_create_users_table.sql`

As migrations aplicadas ficam registradas na tabela `schema_migrations`.

## 5. Criar usuário MASTER

O seed solicita as credenciais **somente na execução** (não usa `.env`):

```bash
npm run seed
```

Ou com argumentos:

```bash
npm run seed -- --name "Master" --email "master@empresa.com" --password "SenhaForte1"
```

O script:

1. Garante as roles `USER`, `ADMIN` e `MASTER`
2. Gera hash com `bcrypt.hash()`
3. Insere o usuário MASTER com status `ACTIVE`

Senha mínima: **8 caracteres**.

## 6. Iniciar ambiente local

Terminal 1 — API:

```bash
npm run dev:backend
```

Terminal 2 — Frontend:

```bash
npm run dev:frontend
```

- API: `http://localhost:3001`
- App: `http://localhost:5173`

## Endpoint de autenticação

`POST /auth/login`

Body:

```json
{
  "email": "master@empresa.com",
  "password": "SenhaForte1"
}
```

Sucesso:

```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": 1,
    "name": "Master",
    "role": "MASTER"
  }
}
```

Erro:

```json
{
  "success": false,
  "message": "Credenciais inválidas",
  "code": "INVALID_CREDENTIALS"
}
```

Códigos relevantes:

| Código | Situação |
|--------|----------|
| `VALIDATION_ERROR` | Body inválido / senha &lt; 8 chars |
| `INVALID_CREDENTIALS` | Email ou senha incorretos |
| `USER_INACTIVE` | Usuário com status `INACTIVE` |

## Arquitetura do backend (login)

```
Route → Validate (Zod) → Controller → Service → Repository → MySQL
```

## Regras de banco

- Toda alteração estrutural gera **nova migration** em `database/migrations/`
- Nunca alterar tabelas manualmente
- Queries **somente** na camada Repository

## Fora do escopo desta fundação

- Dashboard
- Meta API / Lead Ads
- Campanhas
- CRUD de usuários
- Permissões avançadas
