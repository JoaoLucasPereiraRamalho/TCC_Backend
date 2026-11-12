# CLAUDE.md — fittrack-api

API do FitTrack Pro: monólito modular em NestJS 12 + Prisma 7 + PostgreSQL (+ pg-boss a partir da Sprint 5).
Fontes de verdade, leia antes de mudar estrutura ou contrato:

- `docs/especificacao-api.md` — endpoints, envelopes, formato de erro, catálogo de códigos.
- `docs/estrutura-de-pastas-e-modulos.md` — módulos, camadas, matriz de dependências, ordem por sprint.

Se o código precisar divergir dos documentos, **atualize o documento primeiro** e avise.

## Comandos

```bash
npm run dev:api        # API com watch (http://localhost:3000/v1)
npm run dev:worker     # worker com watch
npm test               # Vitest (unitários + HTTP sem banco)
npm run lint           # ESLint (inclui as regras de Clock/IdGenerator/process.env)
npm run typecheck
npm run build
npx prisma migrate dev --name <nome>   # nova migração (precisa do Postgres do docker-compose)
```

Antes de dizer que terminou: `npm run lint && npm run typecheck && npm test`.

## Projeto ESM

- `"type": "module"`. **Imports relativos terminam em `.js`** (`import { ok } from '../http/index.js'`).
- Sem `__dirname`; use `import.meta.dirname`.
- Testes em Vitest com globais: `vi.fn()`, nunca `jest.fn()`. Arquivos `*.spec.ts` em `__tests__/` ao lado do código.
- Cliente Prisma gerado em `src/generated/prisma` (não versionado; `npm install` gera). Importe de `generated/prisma/client.js`.

## Regras que não se negociam

1. **Tempo e ids injetados.** Fora de `src/platform/clock-and-ids`, nunca `new Date()`, `Date.now()`, `DateTime.now()`, `randomUUID()` ou o pacote `uuid`. Injete `CLOCK` (`Clock`) e `ID_GENERATOR` (`IdGenerator`, UUID v7). Em testes use `FixedClock` e `SequentialIdGenerator`. O lint quebra se violar.
2. **Configuração tipada.** Nunca `process.env` fora de `src/platform/config`. Nova variável: adicione em `env.schema.ts`, em `AppConfig`, no `.env.example` e em `test/setup-env.ts`.
3. **Parâmetros de negócio** (meta de 5 dias, 50% das séries, 15 min, janelas de 7 dias e 24 h, expiração de convite) vêm da tabela `system_settings` (seed em `prisma/seed/system-settings.ts`), nunca de constantes no código.
4. **Transações só no caso de uso** (ou no service, no nível A), via `UnitOfWork.run(tx => ...)`. Repositórios recebem `tx: TransactionContext` como parâmetro e nunca abrem transação.
5. **Erros:** regra de negócio lança subclasse de `DomainError` com um `code` do `ERROR_CATALOG` (`shared-kernel/errors/error-codes.ts`). Código novo entra no catálogo **e** na seção 10 da especificação. Nunca capture para ignorar.
6. **Respostas:** sempre `ok(data)` ou `paged(items, page)` / `buildPage(...)` de `shared-kernel/http`. Paginação por cursor opaco (`encodeCursor`/`decodeCursor`), `limit` padrão 20 e máximo 100.
7. **Validação** com schema Zod em `schemas/*.schema.ts` + `ZodValidationPipe`; o tipo de entrada é `z.infer`. Falha vira `422 VALIDATION_ERROR` com `details[].field` no formato `sets[0].reps`.
8. **Posse:** recurso de outro treinador/aluno responde `404`, nunca `403`. A checagem de posse fica no caso de uso (via `linking`), não só no controller.
9. **Datas:** instantes em `timestamptz` (UTC). Datas locais (`LocalDate`, `YYYY-MM-DD`) só são derivadas com `shared-kernel/time` (`localDateOf`, `weekOf`, ...) a partir do fuso do aluno. Nunca grave data local no lugar de instante.
10. **Logs:** nunca registrar senha, token, e-mail, anamnese, medidas corporais ou texto de mensagem. Campo sensível novo entra em `platform/logging/redaction.ts`.
11. **Cargas em kg** na API; conversão para lbs é do cliente.

## Estrutura

```
src/
  main.api.ts / app.module.ts         processo api (HTTP + WebSocket); liga portas entre módulos
  main.worker.ts / worker.module.ts   processo worker (jobs)
  platform/       infraestrutura transversal (config, database, logging, clock-and-ids, queue, storage, push, mail, realtime)
  shared-kernel/  conceitos puros (errors, http, auth, time, types)
  modules/        um módulo por conceito de negócio
```

`platform/` e `shared-kernel/` **nunca** importam de `modules/`. `shared-kernel/` não importa de `platform/`.

### Camadas por módulo

- **Nível A** (identity, linking, students, library, files, notifications, messaging): `controller → service → repository` na raiz do módulo, mais `schemas/`, `*.mapper.ts` (só para a resposta) e `__tests__/`. Sem entity separada (o tipo do Prisma é o modelo), repository é classe concreta sem interface.
- **Nível B** (prescription, execution, progress, gamification): `api/` (controllers + schemas) → `application/` (um caso de uso por arquivo, `ports/`) → `domain/` (regras puras) ← `infrastructure/` (implementa as portas, Prisma, mappers).
  - `domain/` não importa NestJS, Prisma, `application/`, `api/` nem `infrastructure/`.
  - `api/` não importa `infrastructure/` nem Prisma. Controller chama **um** caso de uso.

Não crie `domain/` vazio por simetria nem interface de repositório "para trocar de banco".

### Interface pública e matriz de dependências

Cada módulo tem `index.ts` que exporta só consultas/comandos para outros módulos, seus tipos e os eventos que publica. Outro módulo **só** importa desse `index.ts` e nunca lê tabela de terceiro (exceção: consultas agregadas em `progress/infrastructure/`).

Quem pode importar quem (todo o resto é proibido):

| Módulo        | Pode importar                                   |
| ------------- | ----------------------------------------------- |
| identity      | —                                               |
| linking       | identity                                        |
| files         | linking                                         |
| library       | identity, files                                 |
| notifications | identity                                        |
| prescription  | linking, library, notifications                 |
| execution     | identity, library, prescription                 |
| students      | identity, linking, execution                    |
| gamification  | identity, execution, notifications              |
| progress      | students, prescription, execution, gamification |
| messaging     | linking, notifications                          |

Precisa de um módulo acima de você? Use **porta** (efeito na mesma transação, ex.: `SessionFinishedHook` definida em execution e implementada em gamification, ligada no `app.module.ts`) ou **evento de domínio** via outbox (efeito fora da transação; o evento carrega só ids e fatos).

## Nomes

- Pastas e arquivos em `kebab-case`; identificadores em inglês.
- Caso de uso: `activate-mesocycle.use-case.ts`, classe `ActivateMesocycleUseCase`, método único `execute`.
- Consulta: `get-session-detail.query.ts`. Controller: `sessions.controller.ts`. Schema: `sync-push.schema.ts`.
- Porta: `session.repository.ts` ou `<nome>.port.ts`; implementação com prefixo da tecnologia: `prisma-session.repository.ts`.
- Rotas sob `/v1`, iguais às da especificação.

## Banco

- Um único `prisma/schema.prisma`, com seções por módulo. Modelos em inglês, tabelas/colunas em `snake_case` via `@@map`/`@map`.
- IDs `@db.Uuid` gerados pelo `IdGenerator` (sem `@default(uuid())`); instantes `@db.Timestamptz`.
- Migração aplicada em homologação nunca é editada. Mudança destrutiva em duas etapas.
