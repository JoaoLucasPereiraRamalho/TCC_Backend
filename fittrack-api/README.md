# fittrack-api

API REST do **FitTrack Pro**: prescrição, execução e acompanhamento de treinos de força e hipertrofia.
Monólito modular com NestJS, Prisma e PostgreSQL; o mesmo código sobe como `api` (HTTP) ou `worker` (jobs).

- Contrato: [`docs/especificacao-api.md`](docs/especificacao-api.md)
- Organização do código: [`docs/estrutura-de-pastas-e-modulos.md`](docs/estrutura-de-pastas-e-modulos.md)
- Regras para o assistente de código: [`CLAUDE.md`](CLAUDE.md)

## Requisitos

- Node.js 24 (`.nvmrc`)
- Docker (PostgreSQL 17 e MinIO pelo `docker-compose.yml`)

## Primeiros passos

```bash
npm install                     # também gera o cliente Prisma
cp .env.example .env
docker compose up -d
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev:api                 # http://localhost:3000/v1/health
```

## Scripts

| Script                                   | O que faz                              |
| ---------------------------------------- | -------------------------------------- |
| `npm run dev:api` / `dev:worker`         | Sobe o processo com recarga automática |
| `npm run build`                          | Compila para `dist/`                   |
| `npm run start:api` / `start:worker`     | Roda a versão compilada                |
| `npm test` / `test:watch` / `test:cov`   | Testes (Vitest)                        |
| `npm run lint` / `typecheck`             | ESLint e TypeScript                    |
| `npm run prisma:migrate` / `prisma:seed` | Migrações e dados iniciais             |

## Estrutura

```
src/
├─ main.api.ts, app.module.ts         processo api
├─ main.worker.ts, worker.module.ts   processo worker
├─ platform/        config, database (+ /health), logging, clock-and-ids, queue, storage, push, mail, realtime
├─ shared-kernel/   errors, http (envelope, cursor, validação), auth, time (semana no fuso), types
└─ modules/         identity, linking, students, library, prescription, execution,
                    progress, gamification, messaging, notifications, files
prisma/             schema.prisma, migrations/, seed/
test/               http/, integration/, architecture/, contract/, fixtures/
```

## Estado atual (Sprint 1, FT-1)

Pronto:

- Projeto NestJS (ESM) com processos `api` e `worker`.
- `platform/config`: variáveis validadas com Zod; o processo não sobe com valor ausente ou inválido.
- `platform/logging`: pino em JSON, `X-Request-Id` propagado, redação de campos sensíveis.
- `platform/clock-and-ids`: portas `Clock` e `IdGenerator` (UUID v7), com `FixedClock` para testes.
- `platform/database`: `PrismaService`, `UnitOfWork` e `GET /v1/health`.
- `shared-kernel/errors`: `DomainError`, catálogo de códigos e filtro global no formato de erro da API.
- `shared-kernel/http`: envelopes `{ data }`, paginação por cursor e `ZodValidationPipe`.
- `shared-kernel/time/week.ts`: dia e semana no fuso do aluno, com testes de borda (domingo 23:59, mudança de fuso, horário de verão).
- `prisma/schema.prisma` com o núcleo (usuários, perfis, parâmetros do sistema, outbox) e seed dos parâmetros.
- Lint que bloqueia `new Date()`, `Date.now()`, UUID direto e `process.env` fora da `platform`.
- CI: lint, formatação, tipos, testes e build.

Próximos passos (ordem do documento de estrutura, seção 7): testes de arquitetura com dependency-cruiser e OpenAPI publicada (Sprint 2, FT-7), `identity` e `linking`.
