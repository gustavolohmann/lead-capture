# Testes E2E — Lead Capture SaaS

## Bancos

| Ambiente | Database |
|----------|----------|
| Dev | `lead_capture` |
| Testes | `lead_capture_test` (**obrigatório**) |

Config: `backend/.env.test` com `META_MOCK_MODE=true`.

## Scripts

```bash
npm install
npx playwright install chromium
npm run test:api      # Vitest + Supertest (API)
npm run test:e2e      # Playwright (UI)
npm run test:all
```

## Pastas

```
tests/
  backend/e2e/     # API (cenários 1–11 + negativos)
  frontend/e2e/    # UI (cenário 12)
backend/.env.test
vitest.e2e.config.js
playwright.config.js
```

## Contrato real da API (diferenças vs spec)

| Spec | Código real |
|------|-------------|
| `trigger_key`, `delay_minutes` | `trigger`, `delayMinutes` |
| `POST /campaigns` só name/budget | exige também `adAccountId` |
| `JWT_SECRET=test_secret` | mínimo 16 chars → `test_secret_e2e_ok16` |
| Preview `/forms/:id/public` | API pública; UI = `/forms/:id/preview` |

`META_MOCK_MODE` (opt-in): OAuth, criação de campanha, fetch de lead no webhook e envio WhatsApp usam mocks sem Graph real. Com `false`, fluxo de produção permanece igual.
