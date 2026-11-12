# Estrutura de Pastas e Módulos - fittrack-api

Nov 12, 2026 · @João Lucas Pereira Ramalho

## 1. Princípios

Este documento define como organizar o código do repositório `fittrack-api`: pastas, módulos, o que cada módulo pode usar dos outros e como uma requisição atravessa as camadas. Ele acompanha a *Especificação da API*, que define os endpoints, e o ADR v2, que escolheu monólito modular com NestJS, Prisma, PostgreSQL e pg-boss.

| Princípio | O que significa na prática |
| --- | --- |
| Um módulo por conceito de negócio | As pastas seguem os módulos da API (identidade, vínculos, alunos, biblioteca, prescrição, execução, evolução, gamificação, mensagens, notificações, arquivos), não os tipos técnicos ("todos os controllers juntos") |
| Regras de negócio puras e isoladas | As regras que importam (dia de treino válido, semana concluída, sequência, 1RM, badges) ficam em funções sem NestJS, sem banco e sem relógio global, para testar em milissegundos |
| Dependências em um só sentido | Controller usa caso de uso; caso de uso usa domínio e portas; infraestrutura implementa as portas. Nunca o contrário |
| Fronteira entre módulos explícita | Um módulo só usa o que outro módulo exporta em sua interface pública (`index.ts`). Importar um arquivo interno de outro módulo quebra o CI |
| Tempo e identificadores injetados | Nenhum código de regra chama `new Date()` nem gera UUID direto; usa as portas `Clock` e `IdGenerator`. É o que torna a gamificação determinística e testável (RNF06) |
| Contrato primeiro | Schemas de entrada e saída (Zod) ficam junto de cada controller e geram a OpenAPI; mudar um campo é mudar o contrato (ADR v2, ADR-002) |
| Um ponto de entrada por processo | O mesmo código sobe como `api` (HTTP e WebSocket) ou como `worker` (jobs), escolhidos por variável de ambiente no `main` |

A arquitetura interna de cada módulo é **híbrida**: módulos de CRUD usam camadas simples (controller, service, repository) e os módulos com regra relevante (`gamification`, `execution`, `progress`, `prescription`) ganham uma camada `domain/` pura (seção 4). Não há fonte que eu tenha lido que prove que esse desenho é o melhor para este projeto; é uma escolha de engenharia com o objetivo de manter as regras de negócio testáveis e os módulos desacoplados para um desenvolvedor único, sem pagar o custo de estrutura onde não há regra a proteger.

## 2. Árvore de pastas

```text
fittrack-api/
├─ src/
│  ├─ main.api.ts                 # sobe HTTP + WebSocket
│  ├─ main.worker.ts              # sobe apenas os jobs (pg-boss)
│  ├─ app.module.ts               # compõe os módulos (processo api)
│  ├─ worker.module.ts            # compõe os módulos (processo worker)
│  │
│  ├─ platform/                   # infraestrutura transversal, sem regra de negócio
│  │  ├─ config/                  # leitura e validação (Zod) das variáveis de ambiente
│  │  ├─ database/                # PrismaService, UnitOfWork (transação), health
│  │  ├─ queue/                   # pg-boss: publicação e registro de jobs
│  │  ├─ storage/                 # armazenamento S3-compatível: URLs pré-assinadas
│  │  ├─ push/                    # adaptador de push (Expo)
│  │  ├─ mail/                    # adaptador de e-mail
│  │  ├─ realtime/                # gateway WebSocket e registro de conexões
│  │  ├─ logging/                 # pino, correlation id, redação de campos sensíveis
│  │  └─ clock-and-ids/           # portas Clock e IdGenerator (UUID v7) + implementações
│  │
│  ├─ shared-kernel/              # pequeno, estável, sem dependência de módulos
│  │  ├─ errors/                  # DomainError, códigos de erro, filtro HTTP
│  │  ├─ http/                    # envelope {data}, página por cursor, Idempotency-Key
│  │  ├─ auth/                    # guards, decoradores @CurrentUser, @Roles
│  │  ├─ time/                    # utilitários de fuso e semana (funções puras)
│  │  └─ types/                   # tipos básicos (UserId, Role, Kg, LocalDate)
│  │
│  └─ modules/
│     ├─ identity/                # auth, usuários, perfis, dispositivos, LGPD
│     ├─ linking/                 # convites e vínculos treinador-aluno
│     ├─ students/                # carteira, anotações, anamnese, medidas corporais
│     ├─ library/                 # exercícios, catálogo, alternativas
│     ├─ prescription/            # mesociclos, sessões prescritas, templates, treino do dia
│     ├─ execution/               # sessões executadas, séries, sincronização offline
│     ├─ progress/                # evolução, 1RM, timeline, auditoria, dashboard
│     ├─ gamification/            # dias válidos, semanas, sequência, badges, jobs
│     ├─ messaging/               # conversas e mensagens, eventos de chat
│     ├─ notifications/           # notificações no app, preferências, envio de push
│     └─ files/                   # uploads, anexos, URLs de download
│
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed/                       # exercícios base, catálogo de badges, grupamentos
│
├─ test/
│  ├─ integration/                # Postgres em contêiner; fluxos por módulo
│  ├─ architecture/               # testes que impedem importação proibida
│  ├─ contract/                   # confere que a OpenAPI gerada não quebrou
│  └─ fixtures/                   # dados de teste (alunos, fichas, sessões)
│
├─ docs/                          # ERS, ADR v2, especificação da API, este documento
├─ scripts/                       # utilitários (gerar openapi.json, carga de dados)
├─ .github/workflows/             # CI: lint, tipos, testes, build, publicação da OpenAPI
├─ docker-compose.yml             # Postgres e armazenamento local
├─ .env.example
├─ CLAUDE.md                      # instruções permanentes para o assistente no VS Code
└─ README.md
```

**Por que `platform` e `shared-kernel` são separados:** `platform` fala com o mundo de fora (banco, fila, armazenamento, push) e troca de implementação sem afetar regras. `shared-kernel` só tem conceitos puros usados por vários módulos (tipos, erros, utilitários de fuso). Nenhum dos dois pode importar de `modules/`. Se o `shared-kernel` começar a crescer com regra de negócio, aquela regra pertence a um módulo.

**Dois processos, um código:** `main.api.ts` carrega `app.module.ts` (controllers, WebSocket, guards). `main.worker.ts` carrega `worker.module.ts` (apenas os manipuladores de jobs e o que eles precisam). Ambos usam os mesmos casos de uso e repositórios; o deploy é de duas imagens (ou dois comandos) da mesma base.

## 3. Catálogo de módulos

Para cada módulo: o que ele possui (dados e regras), o que expõe, de quem depende. As entidades são as 17 da ERS (seção 8) mais as de apoio que a API exige (marcadas com um asterisco: `*`), que não estão na ERS e precisam ser criadas.

| Módulo | Possui (entidades) | Endpoints (grupos da API) | Depende de (pela interface pública) |
| --- | --- | --- | --- |
| `identity` | Usuario, Treinador, Aluno, `Sessao de login*` (refresh tokens), `Dispositivo*`, `ConsentimentoLGPD*` | `/auth/*`, `/me`, `/me/preferences`, `/me/devices`, `/me/data-export`, `/config` | `platform` apenas |
| `linking` | Convite, Vinculo | `/invites/*`, `/me/trainer`, `/me/link`, `DELETE /students/{id}/link` | `identity` |
| `students` | MedidaCorporal, Anamnese (e versões), `AnotacaoTreinador*` | `/students` (carteira), `/students/{id}`, `/students/{id}/notes`, `/me/anamnesis`, `/students/{id}/anamnesis*`, `/me/body-measurements` | `identity`, `linking`, `execution` (consulta do último treino, para o status) |
| `library` | Exercicio, `ExercicioAlternativa*`, catálogos (grupamento, equipamento) | `/exercises/*`, `/catalog/*` | `identity`, `files` (mídia) |
| `prescription` | Mesociclo, SessaoPrescrita, SessaoPrescritaItem, Template | `/mesocycles/*`, `/templates/*`, `/me/mesocycle/active`, `/me/workouts` e `/me/workouts/{id}` | `library`, `linking`, `notifications` |
| `execution` | SessaoExecutada, SerieExecutada, `MutacaoSincronizada*` (chaves de idempotência) | `/sync/push`, `/sync/pull`, `/me/sessions/*`, `/me/workouts/today` | `prescription`, `library`, `identity`, porta `SessionFinishedHook` (veja abaixo) |
| `progress` | (nenhuma; consultas sobre execução) | `/me/progress`, `/students/{id}/progress`, `/students/{id}/load-progression`, `/sessions/timeline`, `/sessions/{id}/audit`, `/dashboard` | `execution`, `prescription`, `students`, `gamification` (leitura) |
| `gamification` | SemanaProgresso, Badge, AlunoBadge, `ConfirmacaoCarga*`, cache de estatísticas | `/me/gamification*`, `/me/badges*`, `/students/{id}/gamification`, `/gamification/portfolio` | `execution` (consulta de sessões), `identity` (fuso), `notifications` |
| `messaging` | `Conversa*`, Mensagem | `/conversations/*`, eventos de WebSocket de chat | `linking`, `notifications`, `platform/realtime` |
| `notifications` | Notificacao, preferências por tipo | `/notifications/*` | `identity` (preferências e dispositivos), `platform/push` |
| `files` | Arquivo, `AnexoAluno*` | `/files/*`, `/students/{id}/files`, `/me/shared-files` | `linking`, `platform/storage` |

### Responsabilidades que costumam gerar dúvida

- **Onde mora o fuso horário do aluno?** Em `identity` (campo do usuário). Quem precisa dele (`gamification`, `execution`) lê pela interface pública de `identity`; ninguém copia o campo.
- **Quem calcula o status Ativo, Alerta ou Inativo da carteira?** `students`, a partir de uma consulta de último treino exposta por `execution`. O limiar vem da configuração, não do código.
- **Quem calcula o 1RM?** `progress`, com a fórmula de Epley como função pura em `progress/domain/one-rm.ts` (RN03). A gamificação não usa 1RM.
- **Quem sabe qual é o treino do dia?** `execution`, no caso de uso `GetTodayWorkout`: ele lê a ficha ativa pela interface pública de `prescription`, descobre quais sessões já foram feitas (dado dele) e monta o *ghost data*. Assim `prescription` não precisa importar `execution`, e a dependência fica em um só sentido: `execution` → `prescription`.
- **Quem decide se uma sessão conta para a gamificação?** `gamification` (RN06). `execution` só grava fatos.
- **Quem envia a push?** `notifications`. Os outros módulos pedem a notificação pela interface pública (`notifications.notify(...)`); não chamam o adaptador de push.

### Como `execution` aciona a gamificação sem depender dela

O recálculo da semana corrente precisa acontecer **na mesma requisição e transação** de `SESSION_FINISH` (RNF07). Para que `execution` não importe `gamification` (e `gamification` já lê de `execution`), usa-se inversão de dependência:

1. `execution` define uma **porta** `SessionFinishedHook` com um método `onSessionFinished(tx, sessionId): Promise<SessionEffects>`, onde `SessionEffects` contém `countedForGamification`, `unlockedBadges` e `pendingConfirmations`.
2. `gamification` fornece a **implementação** da porta.
3. O `app.module.ts` (que conhece os dois) liga a implementação à porta.
4. `execution` chama a porta dentro da transação e devolve os efeitos no `sessionSummary`.

O mesmo padrão serve para `SessionEditedHook` e `SessionDeletedHook`. Assim `execution` não sabe que existe gamificação: ele só oferece ganchos. Se a ferramenta de teste de arquitetura reclamar de dependência circular, quase sempre falta uma porta como esta.

### Eventos entre módulos

Para efeitos que **não** precisam estar na mesma transação, o módulo publica um evento de domínio e quem se interessa assina. Eventos são gravados na mesma transação que o dado (padrão *outbox*) e entregues depois pelo worker, via pg-boss, com tentativa repetida em caso de falha.

| Evento | Quem publica | Quem consome |
| --- | --- | --- |
| `MesocycleActivated` | `prescription` | `notifications` (aviso ao aluno), `realtime` (`mesocycle.assigned`) |
| `LinkCreated` / `LinkEnded` | `linking` | `messaging` (cria ou bloqueia conversa), `notifications` |
| `MessageCreated` | `messaging` | `notifications` (push), `realtime` |
| `WeekClosed` | `gamification` (worker) | `notifications`, `realtime` (`gamification.updated`) |
| `BadgeUnlocked` | `gamification` | `notifications` |
| `SessionLateSynced` | `execution` | `gamification` (recálculo de semana antiga, até 7 dias) |

Regra: evento carrega **ids e fatos**, nunca entidades inteiras, e o consumidor lê o que precisa pela interface pública.

## 4. Camadas dentro de um módulo

A organização interna é **híbrida**, com dois níveis. Cada módulo usa um deles, conforme tenha ou não regra de negócio que precise ser protegida e testada sem banco.

| Módulo | Nível | Por quê |
| --- | --- | --- |
| `identity` | A | Cadastro, login e perfil: CRUD e integração com bibliotecas de segurança |
| `linking` | A | Convites e vínculos: regras curtas (expiração, um treinador por vez) cabem no service |
| `students` | A | Carteira, anamnese, medidas. O cálculo do status (Ativo, Alerta, Inativo) fica em um arquivo de função pura, `student-status.ts`, sem criar uma camada `domain/` inteira |
| `library` | A | Catálogo de exercícios: CRUD |
| `files` | A | Uploads e URLs pré-assinadas |
| `notifications` | A | Lista, leitura e envio |
| `messaging` | A | Conversas e mensagens |
| `prescription` | B | Validação da ficha, agrupamentos, tempo estimado, clone e ativação (RN05) |
| `execution` | B | Invariantes da sessão (uma ativa por aluno, janela de 24 horas, volume), idempotência e sincronização |
| `progress` | B | 1RM (RN03), variações, regras de alerta; consultas agregadas na infraestrutura |
| `gamification` | B | O coração do RNF06: dia válido, semana, sequência, badges |

### Nível A: camadas simples

Fluxo: **controller → service → repository**. Exemplo com `library`:

```text
modules/library/
├─ index.ts                      # INTERFACE PÚBLICA do módulo
├─ library.module.ts
├─ exercises.controller.ts       # HTTP: valida (Zod), chama o service, monta o envelope
├─ exercises.service.ts          # regras simples e transação (UnitOfWork)
├─ exercises.repository.ts       # classe concreta com Prisma (sem interface)
├─ exercise.mapper.ts            # só converte o resultado do banco para o formato da resposta da API
├─ schemas/                      # schemas Zod de entrada e saída (geram a OpenAPI)
└─ __tests__/
```

Regras do nível A:

- **Não há entity separada:** o tipo gerado pelo Prisma é o modelo. Não crie classes `Entity` que só repetem o modelo do banco.
- **Repository é uma classe concreta.** Sem interface (porta). Se um dia precisar de fake em teste, extraia a interface nesse momento.
- **Mapper só para a resposta.** Ele existe para não vazar campos internos (hash de senha, ids internos) e para ajustar nomes e formatos ao contrato da API.
- **Service pequeno e focado.** Se o service passar de umas 300 linhas ou misturar assuntos, divida por funcionalidade (`exercises.service.ts`, `exercise-alternatives.service.ts`), ou suba para o nível B.
- **O que continua valendo mesmo no nível A:** o controller nunca usa o Prisma; a transação abre só no service; nada usa `new Date()` ou gera UUID direto (use `Clock` e `IdGenerator`); outro módulo só entra pelo `index.ts`.

### Nível B: camadas com domínio

Fluxo: **controller → caso de uso → domínio**, com repositórios atrás de portas apenas onde o teste com fake compensa. Aqui sim existe entity de domínio separada do modelo do Prisma, com mapper na infraestrutura. Exemplo com `execution`:

```text
modules/execution/
├─ index.ts                      # INTERFACE PÚBLICA: só o que outros módulos podem importar
├─ execution.module.ts           # liga tudo no NestJS
├─ api/                          # camada HTTP
│  ├─ sync.controller.ts
│  ├─ sessions.controller.ts
│  └─ schemas/                   # schemas Zod de entrada e saída (geram a OpenAPI)
│     ├─ sync-push.schema.ts
│     └─ session-detail.schema.ts
├─ application/                  # casos de uso: um arquivo por intenção
│  ├─ push-mutations.use-case.ts
│  ├─ finish-session.use-case.ts
│  ├─ get-session-detail.query.ts
│  └─ ports/                     # interfaces que o domínio/aplicação precisam
│     ├─ session.repository.ts
│     └─ session-finished.hook.ts
├─ domain/                       # regras puras, sem NestJS, sem Prisma
│  ├─ executed-session.ts        # entidade e invariantes (uma sessão ativa por aluno)
│  ├─ executed-set.ts
│  ├─ session-volume.ts          # volume = soma(carga × repetições)
│  ├─ edit-window.ts             # regra das 24 horas
│  └─ errors.ts                  # erros de domínio (ActiveSessionExists, ...)
├─ infrastructure/               # implementa as portas
│  ├─ prisma-session.repository.ts
│  └─ mappers/                   # converte linha do banco ↔ entidade de domínio
└─ __tests__/                    # testes unitários do módulo (domínio e casos de uso)
```

| Camada | Responsabilidade | Pode importar | Não pode importar |
| --- | --- | --- | --- |
| `api/` | Receber HTTP, validar com o schema Zod, chamar **um** caso de uso, montar o envelope de resposta. Sem regra de negócio | `application`, `shared-kernel` | `infrastructure`, Prisma |
| `application/` | Orquestrar: abrir transação, carregar entidades pelas portas, chamar o domínio, salvar, publicar eventos | `domain`, portas, `shared-kernel`, interfaces públicas de outros módulos | `api`, Prisma, NestJS HTTP |
| `domain/` | Regras de negócio e invariantes, funções puras sempre que possível | `shared-kernel/types`, outros arquivos do próprio `domain` | Qualquer outra camada, NestJS, Prisma, `new Date()` |
| `infrastructure/` | Implementar portas (repositório com Prisma, adaptadores) | `domain`, `application/ports`, `platform` | `api` |

### Fluxo de uma requisição (exemplo: `SESSION_FINISH`)

1. `sync.controller.ts` recebe `POST /sync/push`, o schema Zod valida o corpo.
2. O controller chama `PushMutationsUseCase.execute(userId, body)`.
3. O caso de uso abre uma transação (`UnitOfWork`) e, para cada mutação, consulta `MutacaoSincronizada` pela chave `clientMutationId`; se já existe, devolve `DUPLICATE` sem gravar de novo.
4. Para `SESSION_FINISH`, carrega a sessão pelo `SessionRepository`, chama o domínio (`session.finish(rpe, clock.now())`), que valida as invariantes e calcula o volume.
5. Salva a sessão e a marca de idempotência; chama o gancho `SessionFinishedHook` (implementado por `gamification`), ainda dentro da transação.
6. Confirma a transação; devolve os resultados por mutação e o `sessionSummary`.
7. O controller embrulha em `{ "data": ... }` e responde `200`.

Se qualquer passo lançar um `DomainError`, o filtro global converte em resposta com o `code` do catálogo de erros; no `sync/push`, um erro de uma mutação vira `REJECTED` daquela mutação sem derrubar o lote.

### Quando subir um módulo do nível A para o B

Suba quando **qualquer** destas situações aparecer:

- O módulo ganhou uma regra que você quer testar em milissegundos, sem banco, com vários casos de borda (principalmente regras com tempo, fuso ou contagem).
- A mesma regra está sendo copiada em dois lugares.
- Outro módulo precisa acionar o seu dentro de uma transação, o que pede uma porta (como `SessionFinishedHook`).
- O service passou a ter mais lógica de decisão do que de carregar e salvar dados.

**Como subir sem reescrever:** mova só a regra para `domain/` como funções puras, mantenha o service como orquestrador e deixe o repository como está. A entity separada e o mapper de domínio só entram se a regra precisar de um objeto com comportamento próprio.

### O que evitar

- Criar `domain/` vazio por simetria ou entity que só repete o modelo do Prisma.
- Service único com dezenas de métodos (o mesmo vale para um nível B com um único caso de uso gigante).
- Repositórios com interface em todo módulo "para o caso de trocar o banco". A troca de banco não está no escopo; o motivo válido para uma porta é testar com fake ou inverter uma dependência.

### Onde ficam as regras puras importantes

| Regra | Arquivo | Teste |
| --- | --- | --- |
| Dia de treino válido (50% das séries, 15 min; RN06) | `gamification/domain/valid-training-day.ts` | Unitário: casos de borda de porcentagem e duração |
| Semana (segunda a domingo no fuso do aluno) | `shared-kernel/time/week.ts` | Unitário: 23:59 de domingo, mudança de fuso, horário de verão |
| Semana concluída e sequência (RN07, RN08) | `gamification/domain/streak.ts` | Unitário: tabela da ERS 5.2, semana em andamento, recorde |
| Concessão e progresso de badges (RN09, RN10) | `gamification/domain/badge-rules/*.ts` (um arquivo por tipo de critério) | Unitário por badge; teste de não duplicação |
| 1RM por Epley (RN03) | `progress/domain/one-rm.ts` | Unitário: mínimo de 3 execuções, limite de 10 repetições |
| Status Ativo, Alerta, Inativo | `students/domain/student-status.ts` | Unitário com `Clock` fixo |
| Janela de edição de 24 horas | `execution/domain/edit-window.ts` | Unitário |
| Volume da sessão | `execution/domain/session-volume.ts` | Unitário |
| Tempo estimado de um treino | `prescription/domain/estimated-duration.ts` | Unitário |

## 5. Regras de dependência e testes de arquitetura

### Matriz de dependências permitidas

Leia por linha: o módulo da linha **pode** importar (pela interface pública) os módulos marcados com ✓. Todo o resto é proibido. A matriz não tem ciclos; por isso o desenho do documento é uma hierarquia de camadas de módulos.

| Importa → | identity | linking | students | library | files | prescription | execution | progress | gamification | notifications | messaging |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| identity |  |  |  |  |  |  |  |  |  |  |  |
| linking | ✓ |  |  |  |  |  |  |  |  |  |  |
| files |  | ✓ |  |  |  |  |  |  |  |  |  |
| library | ✓ |  |  |  | ✓ |  |  |  |  |  |  |
| notifications | ✓ |  |  |  |  |  |  |  |  |  |  |
| prescription |  | ✓ |  | ✓ |  |  |  |  |  | ✓ |  |
| execution | ✓ |  |  | ✓ |  | ✓ |  |  |  |  |  |
| students | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |  |
| gamification | ✓ |  |  |  |  |  | ✓ |  |  | ✓ |  |
| progress |  |  | ✓ |  |  | ✓ | ✓ |  | ✓ |  |  |
| messaging |  | ✓ |  |  |  |  |  |  |  | ✓ |  |

Todos podem importar `shared-kernel` e `platform`. Ninguém importa `modules/*` de dentro de `shared-kernel` ou `platform`.

**Como ler a hierarquia:** `identity` é a base; `linking`, `notifications` e `library` ficam acima; `prescription` e `files` acima deles; `execution` acima de `prescription`; `gamification` e `students` acima de `execution`; `progress` no topo, só lendo dos outros. Regra de bolso: **se você precisa importar um módulo que está acima de você, use um evento ou uma porta**.

### Regras do que é "interface pública"

- Cada módulo tem um `index.ts` que reexporta apenas: os **serviços de consulta** e **comandos** que outros módulos usam (por exemplo `IdentityQueries.getTimezone(userId)`), os **tipos** retornados por eles e os **eventos** que publica.
- Entidades de domínio, repositórios, modelos do Prisma e schemas Zod de API **não** são exportados.
- Outro módulo nunca lê tabelas que pertencem a um terceiro. Ele pede pela interface pública. Isso vale mesmo que o Prisma torne a leitura direta fácil, porque é isso que permite, no futuro, separar um módulo em serviço.
- Exceção consciente: `progress` é um módulo de leitura e pode fazer consultas agregadas (SQL ou views) sobre tabelas de `execution` e `prescription` por motivos de desempenho (RNF04). Essas consultas ficam em `progress/infrastructure/` e são cobertas por teste de integração que quebra se o esquema mudar.

### Testes de arquitetura (rodam no CI)

Uma ferramenta de análise de dependências (por exemplo `dependency-cruiser` ou `eslint-plugin-boundaries`; são candidatas que eu não verifiquei, confirme na documentação) falha o pipeline quando:

1. Um módulo importa arquivo que não seja o `index.ts` de outro módulo.
2. A matriz acima é violada ou aparece um ciclo entre módulos.
3. `domain/` importa NestJS, Prisma, `application/`, `api/` ou `infrastructure/`.
4. `api/` importa `infrastructure/` ou Prisma.
5. `platform/` ou `shared-kernel/` importam `modules/`.
6. Algum arquivo fora de `platform/clock-and-ids` usa `new Date()`, `Date.now()` ou gera UUID direto (regra de lint customizada ou busca textual no CI).

Os testes de arquitetura são parte do card FT-7 do plano de sprints (Sprint 2).

## 6. Convenções de código, configuração, erros e logs

### Nomes e arquivos

| Tipo | Padrão | Exemplo |
| --- | --- | --- |
| Pasta e arquivo | `kebab-case` | `finish-session.use-case.ts` |
| Caso de uso | `<verbo>-<objeto>.use-case.ts`, classe `FinishSessionUseCase`, método único `execute` | `activate-mesocycle.use-case.ts` |
| Consulta (leitura sem efeito) | `<objeto>.query.ts` | `get-session-detail.query.ts` |
| Controller | `<recurso>.controller.ts` | `sessions.controller.ts` |
| Schema Zod | `<nome>.schema.ts`, tipo derivado com `z.infer` | `sync-push.schema.ts` |
| Porta | `<nome>.repository.ts` ou `<nome>.port.ts` (interface) | `session.repository.ts` |
| Implementação | prefixo da tecnologia | `prisma-session.repository.ts` |
| Teste | ao lado do código em `__tests__/` com `.spec.ts` | `streak.spec.ts` |
| Endpoints | alinhados à *Especificação da API*; mude o documento antes de mudar a rota | `POST /v1/sync/push` |

Identificadores no código em inglês (alinhado à API); textos de mensagens ao usuário ficam nos clientes.

### Configuração

- Todas as variáveis de ambiente são lidas e validadas **uma vez** no início por um schema Zod em `platform/config`. Valor ausente ou inválido impede o processo de subir, com mensagem clara.
- Nenhum módulo lê `process.env` diretamente; recebe um objeto de configuração tipado.
- `.env.example` lista todas as variáveis sem valores secretos; o `.env` real está no `.gitignore`.
- Os parâmetros de negócio que a ERS pede que não fiquem fixos (meta semanal de 5 dias, 50% das séries, 15 minutos, janela de 7 dias, janela de edição de 24 horas, expiração de convite de 7 dias) ficam numa tabela `configuracao_sistema` com valores iniciais no seed, lidos por uma interface pública de `identity` (`SystemSettings`) e expostos em `GET /config`.

### Erros

- Regras de negócio lançam subclasses de `DomainError`, cada uma com `code` (do catálogo da API, seção 10) e um indicador do tipo de falha (`NOT_FOUND`, `CONFLICT`, `VALIDATION`, `FORBIDDEN`, `UNAUTHENTICATED`, `GONE`).
- Um único filtro global em `shared-kernel/errors` converte `DomainError`, falhas de validação Zod e exceções inesperadas no formato de erro da API, com `traceId`.
- Exceções inesperadas viram `500 INTERNAL_ERROR` sem vazar detalhes; o detalhe vai para o log e para o Sentry.
- Nunca capture um erro para ignorá-lo. Se capturar, registre e relance ou converta.

### Autorização

- Guards globais validam o JWT (algoritmo fixo; `iss`, `sub`, `aud`; conforme a RFC 8725) e carregam `@CurrentUser()`.
- `@Roles('TRAINER')` e `@Roles('STUDENT')` bloqueiam por papel no controller.
- **A regra de posse** (treinador só acessa seus alunos; aluno só acessa seus dados) é verificada no **caso de uso**, não só no controller, por meio de `linking`. Recurso de outro dono devolve `404`.
- Testes de autorização por perfil são obrigatórios em todo endpoint que recebe `studentId` (RNF05).

### Banco e transações

- Um único `schema.prisma`, dividido por comentários de seção conforme os módulos. Cada tabela pertence a um módulo (coluna "Possui" da seção 3).
- Todo instante é `timestamptz` (UTC); datas locais (`localDate`) são derivadas no momento do cálculo a partir do fuso do aluno. Nunca grave uma data local como substituta de um instante.
- Transações só no caso de uso, por `UnitOfWork.run(tx => ...)`. Repositórios recebem o contexto transacional como parâmetro; não abrem transação por conta própria.
- Migrações são revisadas como código, nunca editadas depois de aplicadas em homologação. Mudança destrutiva em duas etapas (adiciona, migra dados, remove em release posterior).
- Índices pensados para as consultas do RNF04: sessões executadas por (aluno, início) e por (treinador via vínculo, fim); `SemanaProgresso` único por (aluno, início da semana); `AlunoBadge` único por (aluno, badge); `MutacaoSincronizada` única por `clientMutationId`.

### Jobs (worker)

| Job | Quando | Idempotência |
| --- | --- | --- |
| `weekly-close` | A cada hora; processa alunos cujo fuso acabou de virar segunda-feira 00:05 | Chave (aluno, semana): rodar de novo não muda o resultado |
| `late-sync-recalc` | Sob demanda, ao receber `SessionLateSynced` | Recalcula a semana a partir dos fatos; janela de 7 dias |
| `streak-at-risk` | Diário, às 18:00 no fuso de cada aluno | Máximo uma notificação de gamificação por dia |
| `workout-reminder` | Horário configurado pelo aluno | Uma por aluno e dia |
| `session-auto-close` | A cada 15 minutos; encerra sessão sem atividade por 4 horas | Encerrar duas vezes não muda nada |
| `outbox-dispatch` | Contínuo | Entrega pelo menos uma vez; consumidores toleram repetição |
| `gamification-backfill` | Uma vez, no lançamento do módulo, manual | Calcula do histórico sem notificar (RF-G12) |

Todo job usa o `Clock` injetado, recebe apenas ids e lê o estado do banco ao executar.

### Logs, métricas e dados sensíveis

- Logs estruturados em JSON com `requestId` (o mesmo de `X-Request-Id`), `userId` e módulo.
- **Nunca** registrar senha, token, e-mail completo, anamnese, medidas corporais ou texto de mensagens. A lista de campos a ocultar fica centralizada em `platform/logging`.
- Cada leitura da anamnese gera um registro de auditoria (quem, quando, qual aluno), conforme a LGPD.

### Qualidade

| Nível | O que testa | Ferramentas candidatas |
| --- | --- | --- |
| Unitário (domínio) | Regras puras com `Clock` fixo, sem banco | Vitest ou Jest |
| Casos de uso | Fluxo com repositórios em memória (fakes das portas) | Vitest ou Jest |
| Integração | Controller até o banco real, com PostgreSQL em contêiner | Vitest ou Jest + Testcontainers ou Docker Compose |
| Contrato | A OpenAPI gerada confere com a de referência; mudança incompatível quebra | Comparação de `openapi.json` no CI |
| Arquitetura | Seção 5 | `dependency-cruiser` ou equivalente |

As ferramentas são candidatas; confirme as versões e a compatibilidade com o NestJS na documentação de cada uma antes de fixar.

## 7. Ordem de implementação por sprint

Ordem segue o plano de sprints e a hierarquia de módulos da seção 5: **de baixo para cima**, para nunca precisar de um módulo que ainda não existe.

| Sprint | Módulos e peças a criar | Cards do plano | Observações |
| --- | --- | --- | --- |
| 1 | `platform` (config, database, logging, clock-and-ids), `shared-kernel` (errors, http, types, time), `prisma/schema.prisma` com o núcleo, `docker-compose`, CI | FT-1 a FT-6 | Spike de sincronização usa um protótipo à parte. A função de semana (`shared-kernel/time/week.ts`) já entra com testes de borda |
| 2 | `identity` completo; `linking` (convites e vínculos); guards em `shared-kernel/auth`; teste de arquitetura; OpenAPI publicada | FT-7 a FT-14, FT-67, FT-68 | Primeiro caminho ponta a ponta: cadastro, login, convite, aceite |
| 3 | `students` (sem o status por último treino ainda), `library`, `files` mínimo (uploads de mídia), seed de exercícios | FT-15 a FT-22 | `files` nasce aqui por causa da mídia de exercício; anexos de alunos ficam para a Sprint 8 |
| 4 | `notifications` (só no app, sem push), `prescription` completo | FT-23 a FT-28 | Notificação “nova ficha” precisa existir aqui; push real entra na Sprint 8 |
| 5 | `execution`: sessões, séries, `/sync/push`, idempotência, `GetTodayWorkout`, porta `SessionFinishedHook` (sem implementação ainda) | FT-29 a FT-34 | O gancho de gamificação fica com implementação vazia (sem efeito) até a Sprint 7 |
| 6 | `/sync/pull`, `progress` (evolução, 1RM, timeline, auditoria, dashboard sem alertas de sequência), status da carteira em `students` | FT-35 a FT-41 | Consultas agregadas em `progress/infrastructure` com teste de carga |
| 7 | `gamification` completo e jobs `weekly-close`, `late-sync-recalc`, `streak-at-risk`; implementa o gancho; alerta `STREAK_BROKEN` no dashboard | FT-42 a FT-48 | Teste de determinismo: rodar duas vezes e comparar |
| 8 | `messaging` e WebSocket, push real em `notifications` e `platform/push`, anexos de alunos em `files` | FT-49 a FT-53 | `outbox-dispatch` entra aqui se ainda não existir |
| 9 | Testes de integração completos, revisão de segurança, LGPD (exportação e exclusão), backup, jobs de limpeza | FT-54 a FT-60, FT-70 | Exclusão de conta atravessa vários módulos: cada um oferece a sua parte pela interface pública |
| 10 | Correções do beta, folga, documentação final | FT-61 a FT-66 |  |

### Primeiro dia de código (Sprint 1, FT-1)

1. Crie o projeto NestJS e a estrutura `src/platform`, `src/shared-kernel` e `src/modules` vazia, conforme a seção 2.
2. Implemente `config` (schema Zod das variáveis), `logging` e o `health` (`GET /health`).
3. Implemente as portas `Clock` e `IdGenerator` e suas implementações; escreva o teste que prova que o `Clock` pode ser fixado.
4. Escreva `shared-kernel/errors` (DomainError e filtro global) e `shared-kernel/http` (envelope e cursor), com testes.
5. Escreva `shared-kernel/time/week.ts` com os testes de borda do fuso antes de qualquer módulo de negócio, porque a gamificação inteira depende dela.
6. Crie o `CLAUDE.md` do repositório com as regras desta página (camadas, matriz de dependências, `Clock`, `UnitOfWork`, nomes) para o assistente seguir sempre que você pedir código no VS Code.

### O que atualizar neste documento

Sempre que um módulo mudar de responsabilidade, uma dependência nova for aceita ou um job for adicionado, atualize as seções 3 e 5 **antes** do código. Se a *Especificação da API* mudar um grupo de endpoints, confira a coluna "Endpoints" da seção 3.
