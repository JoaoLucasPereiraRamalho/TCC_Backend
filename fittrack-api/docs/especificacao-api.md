# Especificação da API - Endpoints e Contratos - FitTrack Pro

Nov 12, 2026 · @João Lucas Pereira Ramalho

## 1. Visão geral do projeto

O **FitTrack Pro** é uma plataforma de prescrição, execução e acompanhamento de treinos de força e hipertrofia. O treinador prescreve no **painel web**, o aluno executa no **app mobile** (inclusive sem internet) e cada sessão finalizada alimenta, pela mesma API, os gráficos de evolução, o painel do treinador e a gamificação. Este documento define **todos os endpoints da API REST (`fittrack-api`) e o formato de cada resposta**, para que web e mobile sejam desenvolvidos contra o mesmo contrato. Ele deriva da ERS e do ADR v2; onde a ERS era omissa, a decisão tomada está marcada como **Decisão** e pode ser revista.

### Atores

| Ator | Plataforma | O que faz na API |
| --- | --- | --- |
| Treinador (`TRAINER`) | Web | Gerencia alunos, convites, biblioteca, fichas, templates; audita execuções; vê dashboard, gamificação da carteira, chat e arquivos. Só acessa alunos vinculados a ele |
| Aluno vinculado (`STUDENT`) | Mobile | Executa a ficha do treinador, registra séries, vê evolução e badges, conversa com o treinador |
| Aluno autônomo (`STUDENT` sem vínculo) | Mobile | Monta e executa a própria ficha (RN04); gamificação igual à do vinculado |
| Sistema (jobs) | Backend | Fechamento semanal, recálculo tardio, push, encerramento de sessão inativa. Não tem endpoint público |

O papel vem do token. Aluno vinculado ou autônomo não é um papel: é o estado de ter ou não um vínculo ativo.

### Módulos de negócio

| Módulo | Cobre | Requisitos da ERS |
| --- | --- | --- |
| Identidade | Cadastro, login, SSO, verificação de e-mail, recuperação, perfil, preferências, dispositivos, LGPD | RF-M01, RF-M02, RF-W01, RNF05 |
| Vínculos | Convites, aceite, encerramento | RF-M03, RF-W03 |
| Alunos | Carteira, perfil em abas, anotações, anamnese, medidas corporais | RF-W02, RF-W12, RF-W13, RF-W14 |
| Biblioteca | Exercícios base e personalizados, alternativas, mídia | RF-W08, RF-W09, RF-M10 |
| Prescrição | Mesociclos, sessões prescritas, templates, agrupamentos | RF-W04 a RF-W07, RF-M04, RF-M13 |
| Execução | Sessões executadas, séries, sincronização offline | RF-M05 a RF-M11, RNF02 |
| Evolução | Volume, carga, 1RM, histórico, timeline, auditoria, dashboard | RF-M12, RF-W10, RF-W11, RN03 |
| Gamificação | Dias válidos, semanas, sequência, badges | RF-G01 a RF-G12, RN06 a RN12 |
| Comunicação | Chat, notificações, arquivos | RF-M14, RF-M15, RF-W15 |

### Regras de negócio que moldam os contratos

- **RN05:** a sessão executada aponta para a sessão prescrita por chave estrangeira e nunca copia a ficha. Por isso as respostas de execução trazem `prescribedSessionId` e `prescribedItemId`, e editar uma ficha ativa cria um novo mesociclo (veja a seção 5).
- **RN06 a RN08 e RN11:** dia de treino, semana (segunda a domingo), meta de 5 dias e sequência usam o **fuso do aluno**. Por isso toda resposta de gamificação traz datas locais (`localDate`) além de instantes UTC.
- **RN09, RN12 e RNF06:** badges e sequência são só de leitura para qualquer cliente; **não existe endpoint que escreva** gamificação. A única escrita relacionada é a confirmação de carga suspeita (seção 8).
- **RN03:** o 1RM só aparece com no mínimo 3 execuções válidas nas últimas 4 semanas (Epley, melhor série de até 10 repetições). Sem dados suficientes a API devolve `oneRmKg: null` e `reason: "INSUFFICIENT_DATA"`, e o cliente mostra um estado vazio.
- **RN02:** encerrar vínculo nunca apaga histórico do aluno.
- **Cargas sempre em kg** na API. A unidade de exibição (kg ou lbs) é preferência do usuário e a conversão é feita no cliente (1 lb = 0,4536 kg).

### Fora do escopo desta versão

Pagamentos, ranking entre alunos, pausa de sequência, concessão manual de badges, wearables e plano alimentar (ERS, seção 10).

## 2. Convenções da API

Todas as regras desta seção valem para todos os endpoints. Os exemplos das seções seguintes omitem o que é repetido aqui.

| Tema | Convenção |
| --- | --- |
| Base | `https://api.<domínio>/v1`. WebSocket em `wss://api.<domínio>/v1/ws` |
| Formato | JSON em UTF-8, nomes de campo em `camelCase`, `Content-Type: application/json` (exceto envio direto de arquivos ao armazenamento) |
| Identificadores | UUID (string). Recursos criados offline usam UUID v7 gerado no cliente |
| Instantes | ISO 8601 em UTC com `Z`, ex.: `"2026-11-12T14:03:22Z"` |
| Dias e semanas | `localDate` no formato `YYYY-MM-DD`, sempre no fuso do aluno; `weekStart` é a segunda-feira (`localDate`) |
| Carga | Número em kg com até 2 casas (`82.5`). Repetições inteiras |
| Durações | Segundos inteiros (`durationSeconds`, `restSeconds`) |
| Autenticação | `Authorization: Bearer <accessToken>`. Endpoints públicos estão marcados |
| Cabeçalhos do cliente | `X-Client: web` ou `mobile`; `X-App-Version: 1.4.2` (obrigatório no mobile); `Accept-Language: pt-BR` |
| Idempotência | `Idempotency-Key: <uuid>` em todo `POST` que cria algo fora da sincronização. Repetir a mesma chave com o mesmo corpo devolve a resposta original; com corpo diferente devolve `409 IDEMPOTENCY_CONFLICT` |
| Sincronização offline | Usa `clientMutationId` por mutação (seção 6) em vez do cabeçalho |
| Rastreio | Toda resposta traz o cabeçalho `X-Request-Id`; o mesmo valor vai em `error.traceId` |

### Envelopes de resposta

**Objeto único:**

```json
{ "data": { "id": "0193...", "name": "Carlos" } }
```

**Lista paginada** (paginação por cursor; padrão `limit=20`, máximo 100):

```json
{
  "data": [ { "id": "0193..." } ],
  "page": { "limit": 20, "nextCursor": "eyJ0IjoiMjAy...", "hasMore": true }
}
```

Para a próxima página, envie `?cursor=<nextCursor>`. O cursor é opaco: o cliente nunca o interpreta. Cursor evita saltos e repetições quando entram sessões novas no meio da leitura e mantém a timeline abaixo de 1000 ms (RNF04).

**Sem conteúdo:** `204` sem corpo (exclusões, marcar como lido).

### Formato de erro

Toda falha usa o mesmo formato. O campo `code` é estável e é o que o cliente usa na lógica; `message` é texto para depuração (a interface usa seus próprios textos, em português).

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "details": [
      { "field": "sets[0].reps", "rule": "max", "message": "Deve ser no máximo 100." }
    ],
    "traceId": "7f3c0b9e-..."
  }
}
```

O catálogo completo de códigos está na seção 10. Não há `details` quando não se aplica.

### Códigos HTTP

| Código | Uso |
| --- | --- |
| 200 | Leitura ou atualização com corpo |
| 201 | Criação; traz `Location` e o recurso criado |
| 202 | Aceito para processamento assíncrono (exportação de dados) |
| 204 | Sem conteúdo |
| 400 | Requisição malformada (JSON inválido) |
| 401 | Não autenticado ou token expirado |
| 403 | Autenticado sem permissão |
| 404 | Não encontrado. Também usado quando o recurso pertence a outro treinador, para não revelar que existe |
| 409 | Conflito de estado |
| 410 | Convite expirado ou revogado |
| 413 / 415 | Arquivo grande demais / tipo não aceito |
| 422 | Falha de validação de regra |
| 423 | Conta bloqueada temporariamente |
| 426 | Versão do app abaixo da mínima suportada |
| 429 | Limite de requisições; traz `Retry-After` |
| 5xx | Erro do servidor; o cliente tenta de novo com espera crescente |

### Tokens e sessão

- **Token de acesso:** JWT de curta duração (valor inicial sugerido: 15 minutos, **Decisão**), com `sub`, `role`, `iss`, `aud` e `exp`.
- **Refresh:** token opaco e rotativo. No **mobile** vai no corpo e fica no armazenamento seguro do aparelho. Na **web** vai em cookie `HttpOnly; Secure; SameSite` e não aparece no corpo. Reutilizar um refresh já usado derruba toda a família de tokens.
- A sessão web do treinador expira por inatividade em 12 horas (RF-W01).

### Versão mínima do app

Se `X-App-Version` estiver abaixo da mínima, a API responde `426 UPDATE_REQUIRED` com `error.details[0].minVersion`. O app mostra a tela de atualização. A configuração pública (`GET /config`) traz `minAppVersion` para checagem antecipada.

### Rate limiting

`429 RATE_LIMITED` com `Retry-After` em segundos. Limites mais rígidos em `/auth/*`. O login bloqueia a conta por 15 minutos após 5 falhas seguidas (`423 ACCOUNT_LOCKED`).

## 3. Autenticação e identidade

Módulo **Identidade**. Requisitos: RF-M01, RF-M02, RF-W01, RNF05.

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/register/student` | Público | Cadastro de aluno por e-mail e senha |
| POST | `/auth/register/trainer` | Público | Cadastro de treinador (com CREF) |
| POST | `/auth/sso/google` e `/auth/sso/apple` | Público | Entrada com Google ou Apple (aluno) a partir do `idToken` |
| POST | `/auth/verify-email` | Público | Confirma o e-mail com o token do link |
| POST | `/auth/resend-verification` | Público | Reenvia o link de verificação |
| POST | `/auth/login` | Público | Login; devolve tokens e usuário |
| POST | `/auth/refresh` | Público | Troca refresh por novo par de tokens |
| POST | `/auth/logout` | Logado | Revoga o refresh token atual |
| POST | `/auth/forgot-password` | Público | Envia link de redefinição (válido por 1 hora, uso único) |
| POST | `/auth/reset-password` | Público | Redefine a senha com o token |
| GET | `/me` | Logado | Usuário atual com perfil e estado do vínculo |
| PATCH | `/me` | Logado | Atualiza nome, fuso, unidade de carga |
| PATCH | `/me/student-profile` | Aluno | Nascimento, altura, objetivo, nível |
| PATCH | `/me/trainer-profile` | Treinador | CREF e especialidades |
| GET / PATCH | `/me/preferences` | Logado | Tipos de notificação ligados, horário do lembrete |
| POST | `/me/body-measurements` | Aluno | Registra peso e medidas (cria registro datado) |
| GET | `/me/body-measurements` | Aluno | Histórico de peso e medidas, paginado |
| POST | `/me/devices` | Logado | Registra o token de push do aparelho |
| DELETE | `/me/devices/{deviceId}` | Logado | Remove o aparelho (logout ou token inválido) |
| POST | `/me/data-export` | Logado | Pede exportação dos dados (LGPD); responde `202` |
| DELETE | `/me` | Logado | Exclui a conta e anonimiza os dados (LGPD) |
| GET | `/config` | Público | Configuração: meta semanal, limiares, versão mínima |
| GET | `/health` | Público | Saúde do serviço (para monitoramento) |

**Regras de validação:** senha com no mínimo 8 caracteres, com letra e número; e-mail único; `timezone` precisa ser um nome IANA válido (`America/Sao_Paulo`). Credencial inválida devolve sempre `401 INVALID_CREDENTIALS`, sem revelar se o e-mail existe. `forgot-password` responde `204` mesmo para e-mail inexistente.

### `POST /auth/register/student`

```json
{
  "name": "Carlos Eduardo",
  "email": "carlos@exemplo.com",
  "password": "Senha1234",
  "birthDate": "1998-04-02",
  "timezone": "America/Sao_Paulo",
  "loadUnit": "KG"
}
```

Resposta `201`: `{ "data": { "userId": "0193...", "emailVerificationSent": true } }`. O uso completo exige e-mail confirmado (`403 EMAIL_NOT_VERIFIED` antes disso).

### `POST /auth/register/trainer`

Corpo igual ao do aluno, mais `"cref": "123456-G/SP"` e `"specialties": ["Hipertrofia", "Força"]`; sem `birthDate`.

### `POST /auth/login`

```json
{ "email": "carlos@exemplo.com", "password": "Senha1234" }
```

Resposta `200` (mobile; na web o `refreshToken` não aparece no corpo e vai em cookie):

```json
{
  "data": {
    "accessToken": "eyJhbGciOi...",
    "expiresIn": 900,
    "refreshToken": "rt_9f2c...",
    "user": {
      "id": "0193a1...",
      "name": "Carlos Eduardo",
      "email": "carlos@exemplo.com",
      "role": "STUDENT",
      "timezone": "America/Sao_Paulo",
      "loadUnit": "KG",
      "emailVerified": true
    }
  }
}
```

### `POST /auth/refresh`

Corpo (mobile): `{ "refreshToken": "rt_9f2c..." }`. Na web, sem corpo (cookie + cabeçalho anti-CSRF). Resposta igual à do login, sem `user`. Refresh já usado: `401 REFRESH_REUSED` e todos os refresh do usuário são revogados.

### `GET /me`

```json
{
  "data": {
    "id": "0193a1...",
    "name": "Carlos Eduardo",
    "email": "carlos@exemplo.com",
    "role": "STUDENT",
    "timezone": "America/Sao_Paulo",
    "loadUnit": "KG",
    "studentProfile": { "birthDate": "1998-04-02", "heightCm": 178, "goal": "Hipertrofia", "level": "INTERMEDIATE" },
    "trainerProfile": null,
    "link": {
      "status": "ACTIVE",
      "trainer": { "id": "0192f0...", "name": "João Silva", "cref": "123456-G/SP", "specialties": ["Hipertrofia", "Força"] }
    },
    "unreadNotifications": 3
  }
}
```

Para aluno autônomo, `link` é `null`. Para treinador, `studentProfile` é `null` e `trainerProfile` traz `cref`, `specialties` e `plan` (ex.: `"PRO"`, informativo, sem limite de alunos, RN01).

### `POST /me/body-measurements`

```json
{ "measuredAt": "2026-11-12T08:00:00Z", "weightKg": 82.4, "bodyFatPercent": 14.5, "waistCm": 84, "armCm": 38, "thighCm": 60 }
```

Somente `measuredAt` e `weightKg` são obrigatórios. Resposta `201` com o registro criado (`id` mais os mesmos campos). Faixas válidas: peso 20 a 400 kg; gordura 2 a 70%.

### `GET /config`

```json
{
  "data": {
    "weeklyGoalDays": 5,
    "validDayMinCompletedSetsPercent": 50,
    "validDayMinDurationMinutes": 15,
    "sessionEditWindowHours": 24,
    "inviteExpiresInDays": 7,
    "minAppVersion": "1.0.0"
  }
}
```

Os três valores de gamificação vêm de configuração do sistema (ERS 5.1), não são fixos no código; o cliente os lê daqui apenas para exibir textos.

## 4. Convites, vínculos, alunos e anamnese

Módulos **Vínculos** e **Alunos**. Requisitos: RF-M03, RF-W02, RF-W03, RF-W12 a RF-W14, RN02.

### Convites e vínculos

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| POST | `/invites` | Treinador | Cria convite (link, código e QR) |
| GET | `/invites?status=PENDING` | Treinador | Lista convites; filtro por status |
| POST | `/invites/{inviteId}/regenerate` | Treinador | "Gerar outro": invalida o anterior e cria novo |
| DELETE | `/invites/{inviteId}` | Treinador | Revoga convite pendente |
| GET | `/invites/resolve?code=TJ-9812` ou `?token=...` | Aluno | Mostra quem convidou, antes de aceitar |
| POST | `/invites/accept` | Aluno | Aceita e cria o vínculo |
| GET | `/me/trainer` | Aluno | Cartão do treinador atual (ou `null`) |
| DELETE | `/me/link` | Aluno | Encerra o vínculo; histórico é mantido |
| DELETE | `/students/{studentId}/link` | Treinador | Remove o aluno da carteira; histórico é mantido |

`POST /invites` devolve `201`:

```json
{
  "data": {
    "id": "0193b2...",
    "code": "TJ-9812",
    "url": "https://fittrackpro.com/convite/joao-8a39df",
    "qrPayload": "https://fittrackpro.com/convite/joao-8a39df",
    "status": "PENDING",
    "expiresAt": "2026-11-19T14:03:22Z",
    "createdAt": "2026-11-12T14:03:22Z"
  }
}
```

O QR Code é desenhado pelo cliente a partir de `qrPayload` (a API não gera imagem). `status` é `PENDING`, `USED`, `EXPIRED` ou `REVOKED`.

`GET /invites/resolve` devolve `200` com os dados que o app mostra antes do aceite: `{ "data": { "inviteId": "...", "trainer": { "name": "João Silva", "cref": "123456-G/SP", "specialties": ["Hipertrofia"] } } }`. Erros: `410 INVITE_EXPIRED`, `410 INVITE_REVOKED`, `409 INVITE_USED`. O aceite (`POST /invites/accept` com `{ "inviteId": "..." }`) responde `201` com o vínculo, ou `409 ALREADY_LINKED` se o aluno já tem treinador ativo (máximo um por vez).

### Carteira de alunos (treinador)

| Método | Caminho | Descrição |
| --- | --- | --- |
| GET | `/students` | Carteira. Filtros: `search`, `status` (`ACTIVE`, `ALERT`, `INACTIVE`), `sort` (`name`, `lastWorkoutAt`, `status`); padrão: alertas primeiro |
| GET | `/students/{studentId}` | Visão geral do aluno |
| PUT | `/students/{studentId}/notes` | Anotação privada do treinador (autosave; o aluno nunca vê) |
| GET | `/students/{studentId}/body-measurements` | Peso e medidas do aluno |

Item de `GET /students` (lista paginada por cursor):

```json
{
  "id": "0193c4...",
  "name": "Carlos Eduardo",
  "goal": "Hipertrofia",
  "lastWorkoutAt": "2026-11-10T21:15:00Z",
  "daysSinceLastWorkout": 2,
  "status": "ACTIVE",
  "statusReason": null,
  "currentStreak": 12
}
```

`status` segue a ERS: `ACTIVE` treinou nos últimos 3 dias; `ALERT` de 4 a 6 dias sem treinar ou RPE 9 ou 10 recente (`statusReason`: `"HIGH_RPE"` ou `"NO_WORKOUT_4_6_DAYS"`); `INACTIVE` com 7 dias ou mais. O servidor calcula o status; o cliente só mostra cor e texto.

`GET /students/{id}` (aba Visão Geral):

```json
{
  "data": {
    "id": "0193c4...",
    "name": "Carlos Eduardo",
    "age": 28,
    "heightCm": 178,
    "latestWeightKg": 82.4,
    "goal": "Hipertrofia",
    "level": "INTERMEDIATE",
    "status": "ACTIVE",
    "link": { "since": "2026-08-03" },
    "weekFrequency": { "weekStart": "2026-11-09", "trainedDays": 3, "goalDays": 5 },
    "monthFrequency": { "month": "2026-11", "trainedDays": 9 },
    "recentActivities": [
      { "sessionId": "0193d5...", "workoutName": "Treino A", "finishedAt": "2026-11-10T21:15:00Z", "volumeKg": 5200 }
    ],
    "privateNotes": "Prefere treinar à noite.",
    "activeMesocycle": { "id": "0193e6...", "name": "Hipertrofia 8 semanas", "endsOn": "2026-12-20" },
    "anamnesisSummary": { "hasAnamnesis": true, "painAlerts": ["Dor leve no ombro direito"], "updatedAt": "2026-08-05T10:00:00Z" },
    "gamification": { "currentStreak": 12, "bestStreak": 12, "completedWeeks": 18 }
  }
}
```

O treinador que não é dono do vínculo recebe `404`, nunca `403`.

### Anamnese

Dados de saúde sensíveis: acesso apenas ao aluno e ao treinador vinculado (RNF05); toda leitura é registrada em auditoria.

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| GET | `/me/anamnesis` | Aluno | Anamnese atual |
| PUT | `/me/anamnesis` | Aluno | Preenche ou atualiza; gera nova versão |
| GET | `/students/{studentId}/anamnesis` | Treinador | Anamnese atual do aluno |
| PUT | `/students/{studentId}/anamnesis` | Treinador | Edita; guarda data e autor |
| GET | `/students/{studentId}/anamnesis/versions` | Treinador | Histórico de versões (data e autor) |

```json
{
  "data": {
    "updatedAt": "2026-08-05T10:00:00Z",
    "updatedBy": { "id": "0192f0...", "name": "João Silva", "role": "TRAINER" },
    "objective": { "goal": "Hipertrofia", "desiredFrequencyPerWeek": 5 },
    "experience": { "level": "INTERMEDIATE", "yearsTraining": 3 },
    "health": {
      "conditions": ["Hipertensão leve"],
      "surgeries": [],
      "familyHistory": ["Diabetes"],
      "currentPains": [ { "area": "Ombro direito", "description": "Dor leve ao supino", "severity": 3 } ]
    },
    "lifestyle": { "routine": "Trabalho sentado", "sleepHours": 7, "waterLitersPerDay": 2.5, "supplements": ["Creatina"] },
    "previousTraining": "Acompanhamento em outra academia até 2025."
  }
}
```

`currentPains` alimenta o destaque no topo da aba e no construtor de fichas (campo `painAlerts` na visão geral e em `GET /students/{id}/anamnesis`).

## 5. Biblioteca de exercícios e prescrição de treinos

Módulos **Biblioteca** e **Prescrição**. Requisitos: RF-W04 a RF-W09, RF-M04, RF-M09, RF-M10, RF-M13, RN04, RN05, RN10.

### Biblioteca

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| GET | `/exercises` | Logado | Lista exercícios base e do próprio usuário. Filtros: `search`, `muscleGroup`, `equipment`, `scope` (`BASE`, `CUSTOM`, `ALL`), `cursor` |
| GET | `/exercises/{exerciseId}` | Logado | Detalhe com instruções, vídeo e alternativas |
| POST | `/exercises` | Treinador, aluno autônomo | Cria exercício personalizado |
| PATCH | `/exercises/{exerciseId}` | Dono | Edita personalizado (base é somente leitura) |
| DELETE | `/exercises/{exerciseId}` | Dono | Exclui; `409 EXERCISE_IN_USE` se estiver em ficha ativa |
| GET | `/exercises/{exerciseId}/alternatives` | Logado | Alternativas pré-aprovadas |
| PUT | `/exercises/{exerciseId}/alternatives` | Treinador | Define as alternativas aprovadas (`{ "exerciseIds": [...] }`) |
| GET | `/catalog/muscle-groups` | Logado | Lista de grupamentos (chave e rótulo) |
| GET | `/catalog/equipment` | Logado | Lista de equipamentos |

```json
{
  "id": "0193f7...",
  "name": "Supino reto com barra",
  "muscleGroup": { "key": "CHEST", "label": "Peito" },
  "equipment": { "key": "BARBELL", "label": "Barra" },
  "scope": "BASE",
  "thumbnailUrl": "https://cdn.../supino.jpg",
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "mediaUrl": null,
  "instructions": ["Deite no banco...", "Desça a barra até o peito..."],
  "badgeKey": "BENCH_PRESS",
  "inUse": false
}
```

`scope` vale `BASE` (somente leitura) ou `CUSTOM` (mostra o selo "Personalizado" e as ações de editar e excluir). `badgeKey` só existe em exercícios base mapeados a badges de força (RN10). Exercícios `CUSTOM` ficam visíveis apenas ao dono.

**`POST /exercises`:** `name` (obrigatório, único por dono; duplicado devolve `409 EXERCISE_NAME_TAKEN`), `muscleGroupKey`, `equipmentKey`, `instructions` (lista de textos), `videoUrl` (YouTube ou Vimeo) e `mediaFileId` (opcional; veja o envio de arquivos na seção 9). Imagem ou vídeo: JPG, PNG ou MP4, até 10 MB.

**Exclusão bloqueada:**

```json
{
  "error": {
    "code": "EXERCISE_IN_USE",
    "message": "Exercício em uso por fichas ativas.",
    "details": [ { "mesocycleId": "0193e6...", "mesocycleName": "Hipertrofia 8 semanas", "studentName": "Carlos Eduardo" } ],
    "traceId": "..."
  }
}
```

### Mesociclos (fichas)

Um **mesociclo** é a ficha: um conjunto de **sessões prescritas** (Treino A, B, C...) com itens. Estados: `DRAFT`, `ACTIVE`, `ARCHIVED`. **Decisão (RN05):** um mesociclo `ACTIVE` nunca é editado no lugar. Para alterar, o treinador faz `clone` (cria `DRAFT`), edita e ativa; a ativação arquiva o anterior. Assim, cada sessão executada continua apontando para exatamente o que foi prescrito na época.

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| GET | `/mesocycles?studentId=&status=` | Treinador | Lista (histórico de mesociclos do aluno); sem `studentId`, as próprias fichas do aluno autônomo |
| POST | `/mesocycles` | Treinador, aluno autônomo | Cria um `DRAFT` completo |
| GET | `/mesocycles/{id}` | Dono ou aluno da ficha | Detalhe completo, somente leitura se não for `DRAFT` |
| PUT | `/mesocycles/{id}` | Dono | Substitui o conteúdo de um `DRAFT` (rascunho/autosave) |
| DELETE | `/mesocycles/{id}` | Dono | Exclui um `DRAFT` |
| POST | `/mesocycles/{id}/activate` | Dono | Valida, arquiva a ativa anterior, ativa esta e notifica o aluno |
| POST | `/mesocycles/{id}/clone` | Dono | Cria novo `DRAFT` a partir de qualquer mesociclo |

`POST /mesocycles` e `PUT /mesocycles/{id}` usam o mesmo corpo:

```json
{
  "studentId": "0193c4...",
  "name": "Hipertrofia 8 semanas",
  "focus": "Hipertrofia",
  "startsOn": "2026-11-16",
  "endsOn": "2027-01-10",
  "sessions": [
    {
      "name": "Treino A",
      "subtitle": "Peito e tríceps",
      "order": 1,
      "items": [
        {
          "exerciseId": "0193f7...",
          "order": 1,
          "sets": 4,
          "repsMin": 8,
          "repsMax": 12,
          "restSeconds": 90,
          "cadence": "3010",
          "note": "Controle a descida.",
          "group": null
        },
        {
          "exerciseId": "0193f8...",
          "order": 2,
          "sets": 3,
          "repsMin": 10,
          "repsMax": 10,
          "restSeconds": 60,
          "cadence": null,
          "note": null,
          "group": { "key": "g1", "type": "SUPERSET" }
        }
      ]
    }
  ]
}
```

Para aluno autônomo, `studentId` é omitido (a ficha é dele). `group.key` liga itens consecutivos do mesmo bloco; `type` é `BISET`, `SUPERSET` ou `CIRCUIT`. Repetição fixa usa `repsMin == repsMax`.

**Validações (RF-W05):** `sets` 1 a 20; `repsMin <= repsMax`; `restSeconds` 0 a 600 (padrão 60); `cadence` com 4 caracteres, cada um de `0` a `9` ou `X`; `note` até 300 caracteres. A **ativação** exige ainda que nenhuma sessão esteja vazia (`422 VALIDATION_ERROR`). `DRAFT` aceita ficha incompleta.

Resposta de leitura (`GET /mesocycles/{id}`): o corpo acima mais `id`, `status`, `studentId`, `createdAt`, e em cada sessão e item o `id` gerado (`prescribedSessionId`, `prescribedItemId`) e o objeto `exercise` resumido (`id`, `name`, `thumbnailUrl`, `muscleGroup`, `equipment`) para a tela não precisar de uma chamada por exercício.

### Templates

| Método | Caminho | Descrição |
| --- | --- | --- |
| GET | `/templates` | Templates do treinador |
| POST | `/templates` | Cria a partir de um mesociclo: `{ "name", "description", "fromMesocycleId" }` |
| GET | `/templates/{id}` | Estrutura do template |
| DELETE | `/templates/{id}` | Exclui |
| POST | `/templates/{id}/instantiate` | Cria um `DRAFT` independente para um aluno: `{ "studentId": "..." }` |

A cópia é independente: editar a ficha não muda o template (RF-W07).

### Fichas do ponto de vista do aluno

| Método | Caminho | Descrição |
| --- | --- | --- |
| GET | `/me/mesocycle/active` | Ficha ativa completa (usada para baixar para uso offline) |
| GET | `/me/workouts` | Lista "Meus treinos" (RF-M13); filtro `search` |
| GET | `/me/workouts/today` | Tela inicial: o treino do dia e tudo que a tela mostra |
| GET | `/me/workouts/{prescribedSessionId}` | Prévia da sessão (sem iniciar cronômetro) |

`GET /me/workouts` — item:

```json
{
  "prescribedSessionId": "0193e7...",
  "name": "Treino A",
  "subtitle": "Peito e tríceps",
  "estimatedMinutes": 50,
  "exerciseCount": 5
}
```

`estimatedMinutes` = soma de (séries × tempo médio de execução) + descansos prescritos; o servidor calcula.

`GET /me/workouts/today`:

```json
{
  "data": {
    "greetingName": "Carlos",
    "workout": {
      "prescribedSessionId": "0193e7...",
      "name": "Treino A",
      "subtitle": "Peito e tríceps",
      "estimatedMinutes": 50,
      "exerciseCount": 5,
      "items": [
        {
          "prescribedItemId": "0193e8...",
          "order": 1,
          "exercise": { "id": "0193f7...", "name": "Supino reto barra", "thumbnailUrl": "https://cdn.../supino.jpg" },
          "sets": 4, "repsMin": 8, "repsMax": 12, "restSeconds": 90, "cadence": "3010", "note": null,
          "group": null,
          "previousSets": [ { "setNumber": 1, "loadKg": 85, "reps": 10 }, { "setNumber": 2, "loadKg": 85, "reps": 9 } ],
          "canSubstitute": true
        }
      ]
    },
    "weekFrequency": [
      { "localDate": "2026-11-09", "weekday": "MON", "trained": true },
      { "localDate": "2026-11-10", "weekday": "TUE", "trained": true },
      { "localDate": "2026-11-11", "weekday": "WED", "trained": false, "isToday": true }
    ],
    "lastTrainerMessage": { "id": "0193a9...", "text": "Foque na progressão de carga no supino hoje!", "sentAt": "2026-11-11T09:00:00Z" },
    "gamification": { "currentStreak": 12, "trainedDaysThisWeek": 3, "goalDays": 5 },
    "activeSession": null
  }
}
```

`previousSets` é o *ghost data* (RF-M07): carga e repetições da mesma série na última sessão com aquele exercício; vazio quando não há histórico. `weekFrequency` traz os 7 dias da semana corrente (segunda a domingo, `localDate` no fuso do aluno). `activeSession` não é `null` se já existe sessão em andamento (apenas uma por aluno). **A sessão do dia** é a próxima da rotação (A, B, C...) ainda não concluída; sem ficha ativa a resposta traz `"workout": null` e o cliente mostra o estado vazio (vincular treinador ou criar ficha própria, RN04).

## 6. Execução de treino e sincronização offline

Módulo **Execução**. Requisitos: RF-M05 a RF-M11, RNF02, RF-G10, RN05.

### Princípio: o cliente registra fatos, o servidor decide consequências

O app grava tudo primeiro no SQLite local e envia **mutações** em lote. Cada mutação tem um `clientMutationId` (UUID v7 gerado no aparelho) usado como chave de idempotência: reenviar a mesma mutação não grava duas vezes. Pontos, sequência e badges **nunca** são calculados no app; o app mostra "pendente" até o servidor confirmar.

| Método | Caminho | Descrição |
| --- | --- | --- |
| POST | `/sync/push` | Envia um lote de mutações (até 100 por chamada), em ordem |
| GET | `/sync/pull?cursor=` | Baixa mudanças do servidor desde o cursor (ficha ativa, vínculo, estado de gamificação, mensagens novas) |
| GET | `/me/sessions/active` | Sessão em andamento (ou `null`) |
| GET | `/me/sessions` | Histórico de sessões finalizadas, paginado por cursor (filtros `from`, `to`) |
| GET | `/me/sessions/{sessionId}` | Detalhe série a série de uma sessão |

O mesmo conteúdo pode ser enviado em endpoints REST isolados no futuro, mas **na versão 1 a escrita da execução acontece somente por `/sync/push`**, tanto online quanto offline, para existir um único caminho a testar.

### `POST /sync/push`

```json
{
  "deviceId": "0193aa...",
  "mutations": [
    {
      "clientMutationId": "0193b001-...",
      "type": "SESSION_START",
      "occurredAt": "2026-11-12T20:00:03Z",
      "payload": { "sessionId": "0193b000-...", "prescribedSessionId": "0193e7..." }
    },
    {
      "clientMutationId": "0193b002-...",
      "type": "SET_UPSERT",
      "occurredAt": "2026-11-12T20:06:40Z",
      "payload": {
        "sessionId": "0193b000-...",
        "setId": "0193b003-...",
        "prescribedItemId": "0193e8...",
        "exerciseId": "0193f7...",
        "setNumber": 1,
        "loadKg": 87.5,
        "reps": 10,
        "actualRestSeconds": 92,
        "isExtra": false,
        "completedAt": "2026-11-12T20:06:40Z"
      }
    },
    {
      "clientMutationId": "0193b0ff-...",
      "type": "SESSION_FINISH",
      "occurredAt": "2026-11-12T20:58:10Z",
      "payload": { "sessionId": "0193b000-...", "rpe": 8 }
    }
  ]
}
```

**Tipos de mutação (`type`):**

| Tipo | Payload | Efeito |
| --- | --- | --- |
| `SESSION_START` | `sessionId`, `prescribedSessionId` | Cria a sessão executada; recusa se já há uma ativa (`ACTIVE_SESSION_EXISTS`) |
| `SET_UPSERT` | dados da série (acima) | Cria ou atualiza a série; carga 0 a 1000 kg, reps 1 a 100 |
| `SET_DELETE` | `sessionId`, `setId` | Apaga série concluída |
| `EXERCISE_NOTE` | `sessionId`, `prescribedItemId`, `text` | Observação do aluno ao treinador |
| `EXERCISE_SUBSTITUTE` | `sessionId`, `prescribedItemId`, `substituteExerciseId` | Troca valida somente nas alternativas aprovadas; fica na auditoria |
| `EXERCISE_SKIP` | `sessionId`, `prescribedItemId` | Marca como não realizado |
| `SESSION_FINISH` | `sessionId`, `rpe` (1 a 10) | Finaliza e dispara recálculo |
| `SESSION_DELETE` | `sessionId` | Exclui sessão dentro da janela de 24 h |
| `BODY_MEASUREMENT_ADD` | igual à seção 3 | Registra peso/medidas feitos offline |
| `MESSAGE_SEND` | `conversationId`, `messageId`, `text` | Mensagens escritas offline |

As séries extras usam `isExtra: true` e `prescribedItemId` do exercício ao qual se somam. O servidor aceita `SET_UPSERT`, `SET_DELETE` e `SESSION_DELETE` em sessão finalizada só dentro de 24 horas (`sessionEditWindowHours`); depois disso devolve `409 SESSION_EDIT_WINDOW_EXPIRED` para aquela mutação. Uma sessão sem atividade por 4 horas é encerrada automaticamente pelo servidor com o que foi registrado.

**Resposta `200`** (sempre `200` se o lote foi processado; o resultado de cada mutação está no corpo):

```json
{
  "data": {
    "results": [
      { "clientMutationId": "0193b001-...", "status": "APPLIED" },
      { "clientMutationId": "0193b002-...", "status": "DUPLICATE" },
      {
        "clientMutationId": "0193b0ff-...",
        "status": "APPLIED",
        "sessionSummary": {
          "sessionId": "0193b000-...",
          "durationSeconds": 3367,
          "volumeKg": 5200,
          "completedSets": 18,
          "prescribedSets": 20,
          "personalRecords": [ { "exerciseId": "0193f7...", "type": "LOAD", "valueKg": 90 } ],
          "countedForGamification": true,
          "notCountedReason": null,
          "unlockedBadges": [ { "key": "IRON_ROUTINE", "name": "Fera da Rotina", "icon": "fera-da-rotina", "unlockedAt": "2026-11-12T20:58:11Z" } ],
          "pendingConfirmations": []
        }
      }
    ],
    "nextPullCursor": "eyJ0IjoiMjAy..."
  }
}
```

`status` de cada resultado:

| Valor | Significado | O que o cliente faz |
| --- | --- | --- |
| `APPLIED` | Gravada | Remove da fila |
| `DUPLICATE` | Já havia sido gravada com esta chave | Remove da fila (não é erro) |
| `REJECTED` | Regra violada (ex.: `SESSION_EDIT_WINDOW_EXPIRED`, validação), com `error` no mesmo formato da seção 2 | Remove da fila e mostra o motivo; **não** tenta de novo |
| `DEFERRED` | Depende de uma mutação anterior que ainda não chegou | Mantém na fila e reenvia depois |

Falhas de rede ou `5xx` no lote inteiro: o cliente reenvia o mesmo lote com espera crescente; pela idempotência nada duplica. `sessionSummary` vem apenas em `SESSION_FINISH` aplicado. Quando a sessão não conta para a gamificação, `countedForGamification` é `false` e `notCountedReason` é `"LESS_THAN_50_PERCENT_SETS"` ou `"SHORTER_THAN_15_MINUTES"`.

**Decisão (RNF07):** o recálculo da **semana corrente** do aluno acontece na mesma requisição de `SESSION_FINISH`, dentro de uma transação; assim o sumário já volta com os badges desbloqueados e o limite de 5 segundos é cumprido. O fechamento semanal e o recálculo de semanas antigas (sincronização tardia, até 7 dias) rodam no worker, e o resultado chega ao app pelo `sync/pull` e pelo evento de WebSocket `gamification.updated`.

### `GET /sync/pull`

Primeira chamada sem `cursor` devolve o estado inicial. Chamadas seguintes devolvem somente o que mudou:

```json
{
  "data": {
    "activeMesocycle": { "id": "0193e6...", "version": 3 },
    "mesocycleChanged": true,
    "link": { "status": "ACTIVE", "trainerId": "0192f0..." },
    "gamification": { "currentStreak": 13, "bestStreak": 13, "completedWeeks": 19 },
    "newMessages": 2,
    "nextPullCursor": "eyJ0IjoiMjAy..."
  }
}
```

Se `mesocycleChanged` for `true`, o app baixa `GET /me/mesocycle/active` para atualizar o treino offline. Para o aluno autônomo, a ficha só muda quando ele mesmo a altera, então o `mesocycleChanged` dele vem `false`.

### `GET /me/sessions/{sessionId}`

```json
{
  "data": {
    "id": "0193b000-...",
    "prescribedSessionId": "0193e7...",
    "workoutName": "Treino A",
    "startedAt": "2026-11-12T20:00:03Z",
    "finishedAt": "2026-11-12T20:58:10Z",
    "localDate": "2026-11-12",
    "durationSeconds": 3367,
    "rpe": 8,
    "volumeKg": 5200,
    "countedForGamification": true,
    "editableUntil": "2026-11-13T20:58:10Z",
    "exercises": [
      {
        "prescribedItemId": "0193e8...",
        "exercise": { "id": "0193f7...", "name": "Supino reto barra" },
        "status": "DONE",
        "substitutedFrom": null,
        "note": "Dor leve no ombro.",
        "sets": [
          { "setId": "0193b003-...", "setNumber": 1, "loadKg": 87.5, "reps": 10, "actualRestSeconds": 92, "isExtra": false }
        ]
      }
    ]
  }
}
```

`status` do exercício: `DONE`, `PARTIAL`, `SKIPPED` ou `SUBSTITUTED`. `localDate` é o dia no fuso do aluno em que a sessão começou (uma sessão que cruza a meia-noite conta no dia em que foi iniciada, ERS 5.5).

## 7. Evolução, histórico, timeline e dashboard

Módulo **Evolução**. Requisitos: RF-M12, RF-W10, RF-W11, RF-W12, RF-W14, RN03, RNF04. Todos os cálculos são feitos no servidor (volume, 1RM, variação); o cliente apenas desenha.

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| GET | `/me/progress` | Aluno | Gráfico e cartões da aba Evolução |
| GET | `/students/{studentId}/progress` | Treinador | Mesmo contrato, para o aluno escolhido |
| GET | `/students/{studentId}/load-progression` | Treinador | Progressão de cargas por exercício |
| GET | `/sessions/timeline` | Treinador | Feed de sessões concluídas da carteira |
| GET | `/sessions/{sessionId}/audit` | Treinador | Prescrito x executado de uma sessão |
| GET | `/dashboard` | Treinador | Cartões, alertas, agenda e atividades recentes |

### `GET /me/progress` e `GET /students/{id}/progress`

Parâmetros: `metric` (`VOLUME`, `LOAD`, `ONE_RM`), `period` (`4W`, `3M`, `6M`, `ALL`), `exerciseId` (obrigatório para `LOAD` e `ONE_RM`), `muscleGroup` (opcional, para `VOLUME`).

```json
{
  "data": {
    "metric": "VOLUME",
    "unit": "KG",
    "period": "4W",
    "points": [
      { "weekStart": "2026-10-12", "label": "Sem 1", "value": 3800 },
      { "weekStart": "2026-10-19", "label": "Sem 2", "value": 4200 },
      { "weekStart": "2026-10-26", "label": "Sem 3", "value": 4500 },
      { "weekStart": "2026-11-02", "label": "Sem 4", "value": 4800 },
      { "weekStart": "2026-11-09", "label": "Sem 5", "value": 5200 }
    ],
    "variationPercent": 12.5,
    "variationComparedTo": "PREVIOUS_PERIOD",
    "cards": {
      "oneRm": [
        { "exerciseId": "0193f7...", "exerciseName": "Agachamento livre", "valueKg": 125, "reason": null }
      ],
      "completedSessionsThisMonth": 18
    }
  }
}
```

O 1RM usa a fórmula de Epley sobre a melhor série de até 10 repetições, e só é exibido com no mínimo 3 execuções válidas nas últimas 4 semanas (RN03); senão, `valueKg: null` e `reason: "INSUFFICIENT_DATA"`. Para `LOAD` e `ONE_RM`, cada ponto traz a melhor carga ou o 1RM da semana. `variationPercent` é `null` quando não há período anterior para comparar.

### `GET /students/{id}/load-progression`

```json
{
  "data": [
    {
      "exerciseId": "0193f7...",
      "exerciseName": "Supino reto barra",
      "initialLoadKg": 70,
      "currentLoadKg": 90,
      "gainKg": 20,
      "trend": [70, 75, 80, 85, 90]
    }
  ]
}
```

Filtro opcional `exerciseId`. `trend` é a melhor carga por semana, para a miniatura.

### `GET /sessions/timeline`

Filtros: `studentId` (opcional), `cursor`. Paginação de 20 itens, mais recentes primeiro, com índice por aluno e data para ficar abaixo de 1000 ms (RNF04).

```json
{
  "data": [
    {
      "sessionId": "0193b000-...",
      "student": { "id": "0193c4...", "name": "Carlos Eduardo" },
      "workoutName": "Treino A",
      "finishedAt": "2026-11-12T20:58:10Z",
      "durationSeconds": 3367,
      "volumeKg": 5200,
      "rpe": 8,
      "highRpe": false,
      "hasSubstitutions": true,
      "hasNotes": true
    }
  ],
  "page": { "limit": 20, "nextCursor": "eyJ0Ijoi...", "hasMore": true }
}
```

`highRpe` é `true` para RPE 9 ou 10 (destaque de atenção).

### `GET /sessions/{sessionId}/audit`

A comparação usa a chave estrangeira da sessão executada para a prescrita (RN05):

```json
{
  "data": {
    "sessionId": "0193b000-...",
    "student": { "id": "0193c4...", "name": "Carlos Eduardo" },
    "workoutName": "Treino A",
    "finishedAt": "2026-11-12T20:58:10Z",
    "rpe": 8,
    "exercises": [
      {
        "exercise": { "id": "0193f7...", "name": "Supino reto barra" },
        "prescribed": { "sets": 4, "repsMin": 8, "repsMax": 12, "restSeconds": 90 },
        "executed": {
          "sets": [
            { "setNumber": 1, "loadKg": 87.5, "reps": 10, "actualRestSeconds": 92, "isExtra": false },
            { "setNumber": 2, "loadKg": 87.5, "reps": 7, "actualRestSeconds": 120, "isExtra": false }
          ]
        },
        "differences": [ { "setNumber": 2, "type": "REPS_BELOW_RANGE" } ],
        "substitutedFrom": null,
        "studentNote": "Dor leve no ombro."
      }
    ]
  }
}
```

Tipos de `differences`: `REPS_BELOW_RANGE`, `REPS_ABOVE_RANGE`, `REST_LONGER`, `REST_SHORTER`, `EXTRA_SET`, `SET_MISSING`, `SKIPPED`.

### `GET /dashboard`

```json
{
  "data": {
    "cards": {
      "activeStudents": { "value": 24, "variationThisMonth": 3 },
      "workoutsToday": { "completed": 6, "expected": 14 },
      "expiringMesocycles": { "count": 4, "withinDays": 7 },
      "averageWeeklyFrequency": { "value": 3.8, "unit": "DAYS" }
    },
    "alerts": [
      { "type": "HIGH_RPE", "student": { "id": "0193c4...", "name": "Carlos" }, "sessionId": "0193b000-...", "occurredAt": "2026-11-12T20:58:10Z" },
      { "type": "INACTIVE_4_DAYS", "student": { "id": "0193c5...", "name": "Marina" }, "daysSinceLastWorkout": 5 },
      { "type": "STREAK_BROKEN", "student": { "id": "0193c6...", "name": "Paulo" }, "previousStreak": 6 },
      { "type": "NO_MESOCYCLE_NEXT_WEEK", "student": { "id": "0193c7...", "name": "Ana" } }
    ],
    "agenda": [
      { "type": "MESOCYCLE_EXPIRING", "date": "2026-11-16", "student": { "id": "0193c4...", "name": "Carlos" }, "mesocycleId": "0193e6..." }
    ],
    "recentActivities": [
      { "sessionId": "0193b000-...", "student": { "id": "0193c4...", "name": "Carlos" }, "workoutName": "Treino A", "finishedAt": "2026-11-12T20:58:10Z" }
    ]
  }
}
```

O alerta `STREAK_BROKEN` só aparece para sequências anteriores de 4 semanas ou mais (RF-G11). **Ponto em aberto:** a ERS cita "avaliações físicas" na agenda, mas não há entidade para elas no modelo de 17 entidades. Nesta versão a agenda só tem vencimentos de ficha (`MESOCYCLE_EXPIRING`); para agendar avaliações, seria preciso criar a entidade e os endpoints.

## 8. Gamificação

Módulo **Gamificação**. Requisitos: RF-G01 a RF-G12, RN06 a RN12, RNF06, RNF07. **Somente leitura para clientes**: não existe endpoint para conceder, remover ou editar badge, sequência ou dia de treino (RN12). A única escrita é a confirmação de carga suspeita feita pelo próprio aluno.

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| GET | `/me/gamification` | Aluno | Tela de gamificação: resumo, meta e trilha |
| GET | `/me/gamification/weeks` | Aluno | Trilha de semanas, paginada |
| GET | `/me/gamification/weeks/{weekStart}` | Aluno | Dias treinados de uma semana |
| GET | `/me/badges` | Aluno | Catálogo com estado e progresso. Filtros `category`, `state` |
| GET | `/me/badges/{badgeKey}` | Aluno | Detalhe de um badge |
| GET | `/me/gamification/confirmations` | Aluno | Cargas aguardando confirmação |
| POST | `/me/gamification/confirmations/{id}` | Aluno | Confirma ou rejeita o valor (`{ "confirmed": true }`) |
| GET | `/students/{studentId}/gamification` | Treinador | Cartão do perfil do aluno |
| GET | `/gamification/portfolio` | Treinador | Carteira: sequência e último badge por aluno |

### `GET /me/gamification`

```json
{
  "data": {
    "weeklyGoalDays": 5,
    "currentStreak": 12,
    "bestStreak": 12,
    "completedWeeks": 18,
    "currentWeek": {
      "weekStart": "2026-11-09",
      "weekEnd": "2026-11-15",
      "trainedDays": 3,
      "remainingDays": 2,
      "completed": false,
      "trainedLocalDates": ["2026-11-09", "2026-11-10", "2026-11-12"]
    },
    "nextGoal": { "badgeKey": "IRON_MEDAL", "name": "Medalha de Ferro", "targetWeeks": 16, "progressPercent": 75 },
    "track": [
      { "weekNumber": 11, "weekStart": "2026-08-31", "state": "COMPLETED" },
      { "weekNumber": 12, "weekStart": "2026-09-07", "state": "COMPLETED" },
      { "weekNumber": 13, "weekStart": "2026-11-09", "state": "CURRENT" },
      { "weekNumber": 14, "weekStart": "2026-11-16", "state": "FUTURE" }
    ],
    "recentBadges": [
      { "key": "IRON_ROUTINE", "name": "Fera da Rotina", "unlockedAt": "2026-11-02T22:10:00Z" }
    ],
    "streakAtRisk": false
  }
}
```

`state` na trilha: `COMPLETED`, `CURRENT` ou `FUTURE`. A semana só vira `COMPLETED` na hora em que o aluno atinge o quinto dia, antes do domingo (ERS 5.2). `streakAtRisk` é `true` quando os dias restantes na semana (contando hoje) igualam os treinos que faltam. `progressPercent` = sequência atual dividida pela próxima meta, nunca acima de 100. O servidor devolve a trilha desde as semanas concluídas até a próxima meta; para histórico mais antigo, use `/me/gamification/weeks?cursor=`.

### `GET /me/badges`

```json
{
  "data": [
    {
      "key": "LEGEND_OF_STRENGTH",
      "name": "Lenda da Força",
      "description": "Série de levantamento terra com 200 kg ou mais.",
      "category": "STRENGTH",
      "icon": "lenda-da-forca",
      "state": "IN_PROGRESS",
      "progress": { "current": 180, "target": 200, "unit": "KG", "percent": 90 },
      "unlockedAt": null,
      "origin": null
    },
    {
      "key": "IRON_ROUTINE",
      "name": "Fera da Rotina",
      "description": "12 semanas concluídas consecutivas.",
      "category": "CONSISTENCY",
      "icon": "fera-da-rotina",
      "state": "UNLOCKED",
      "progress": { "current": 12, "target": 12, "unit": "WEEKS", "percent": 100 },
      "unlockedAt": "2026-11-02T22:10:00Z",
      "origin": { "type": "WEEK", "weekStart": "2026-10-26" }
    }
  ]
}
```

`category`: `CONSISTENCY`, `VOLUME`, `STRENGTH`. `state`: `LOCKED`, `IN_PROGRESS`, `UNLOCKED`. `origin.type`: `SESSION` (com `sessionId`) ou `WEEK` (com `weekStart`). Badge desbloqueado nunca volta a bloqueado (RN09). `progress.current` nunca passa de `target`.

### Confirmação de carga suspeita

Para badges de força, uma carga mais de 50% acima do melhor registro anterior fica pendente (ERS 5.4):

```json
{
  "data": [
    {
      "id": "0193f0...",
      "exerciseName": "Levantamento terra",
      "loadKg": 210,
      "previousBestKg": 130,
      "sessionId": "0193b000-...",
      "createdAt": "2026-11-12T20:58:11Z"
    }
  ]
}
```

`POST .../confirmations/{id}` com `{ "confirmed": true }` conta a carga para o badge; com `false` ela é descartada para a gamificação (a série permanece no histórico).

### Visão do treinador

`GET /students/{id}/gamification`:

```json
{
  "data": {
    "currentStreak": 12,
    "bestStreak": 12,
    "completedWeeks": 18,
    "trainedDaysThisWeek": 3,
    "goalDays": 5,
    "latestBadges": [ { "key": "IRON_ROUTINE", "name": "Fera da Rotina", "unlockedAt": "2026-11-02T22:10:00Z" } ]
  }
}
```

`GET /gamification/portfolio` (filtros `atRisk=true`, `sort=currentStreak|bestStreak|latestBadgeAt`, `cursor`):

```json
{
  "data": [
    {
      "student": { "id": "0193c4...", "name": "Carlos Eduardo" },
      "currentStreak": 12,
      "bestStreak": 12,
      "latestBadge": { "key": "IRON_ROUTINE", "name": "Fera da Rotina", "unlockedAt": "2026-11-02T22:10:00Z" },
      "streakAtRisk": false
    }
  ],
  "page": { "limit": 20, "nextCursor": null, "hasMore": false }
}
```

Não há ranking entre alunos e nenhum endpoint expõe dados de um aluno a outro. A carga inicial do histórico (RF-G12) é um job interno executado uma vez no lançamento do módulo, sem endpoint público e sem notificações.

### Eventos em tempo real

Quando o worker fecha uma semana ou recalcula uma semana antiga, o servidor emite no WebSocket do aluno o evento `gamification.updated` com o mesmo corpo de `GET /me/gamification`. Se o app estiver fechado, a push de gamificação (máximo uma por dia) leva o usuário de volta.

## 9. Chat, notificações e arquivos

Módulo **Comunicação**. Requisitos: RF-M14, RF-M15, RF-W15, RF-G09, RF-W09.

### Chat

Uma conversa por vínculo (treinador e aluno). Mensagens de texto de até 2.000 caracteres, com status `SENT` e `READ`.

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| GET | `/conversations` | Logado | Conversas do usuário com última mensagem e não lidas (treinador: uma por aluno; aluno: no máximo uma) |
| GET | `/conversations/{conversationId}/messages` | Participante | Histórico paginado por cursor (mais recentes primeiro) |
| POST | `/conversations/{conversationId}/messages` | Participante | Envia mensagem |
| POST | `/conversations/{conversationId}/read` | Participante | Marca como lidas até uma mensagem |

Envio: `{ "messageId": "0193aa10-...", "text": "Muito bom! Consegui aumentar a carga." }`. O `messageId` é um UUID v7 gerado no cliente e funciona como chave de idempotência; mensagens escritas offline vão pela mutação `MESSAGE_SEND` do `/sync/push` (seção 6) e o mesmo `messageId` evita duplicata. Resposta `201`:

```json
{
  "data": {
    "id": "0193aa10-...",
    "conversationId": "0193a900-...",
    "sender": { "id": "0193a1...", "name": "Carlos Eduardo", "role": "STUDENT" },
    "text": "Muito bom! Consegui aumentar a carga.",
    "sentAt": "2026-11-12T21:10:00Z",
    "readAt": null,
    "status": "SENT"
  }
}
```

`GET /conversations` — item:

```json
{
  "id": "0193a900-...",
  "participant": { "id": "0192f0...", "name": "João Silva", "role": "TRAINER" },
  "lastMessage": { "text": "Foque na progressão de carga no supino hoje!", "sentAt": "2026-11-11T09:00:00Z", "fromMe": false },
  "unreadCount": 1
}
```

Texto com mais de 2.000 caracteres devolve `422 VALIDATION_ERROR`. Mensagens de um vínculo encerrado ficam somente leitura (`409 LINK_NOT_ACTIVE` ao enviar).

### Notificações

| Método | Caminho | Descrição |
| --- | --- | --- |
| GET | `/notifications` | Lista do sino; filtro `unread=true`; paginada |
| GET | `/notifications/unread-count` | Contador do indicador do sino |
| POST | `/notifications/read` | Marca como lidas: `{ "ids": [...] }` ou `{ "all": true }` |

```json
{
  "id": "0193c001-...",
  "type": "BADGE_UNLOCKED",
  "title": "Nova conquista: Fera da Rotina",
  "body": null,
  "createdAt": "2026-11-12T20:58:11Z",
  "readAt": null,
  "target": { "screen": "GAMIFICATION_BADGE", "params": { "badgeKey": "IRON_ROUTINE" } }
}
```

`type` aceitos: `NEW_MESOCYCLE`, `TRAINER_MESSAGE`, `WORKOUT_REMINDER`, `REST_FINISHED` (local, gerada no aparelho e não pela API), `WEEK_COMPLETED`, `STREAK_AT_RISK`, `BADGE_UNLOCKED`, `STREAK_BROKEN`, e para o treinador `STUDENT_MESSAGE`, `STUDENT_HIGH_RPE`, `STUDENT_PAIN_REPORTED`. O campo `target` diz ao app para qual tela navegar ao tocar. As preferências de cada tipo ficam em `/me/preferences` (seção 3). No máximo uma push de gamificação por dia; o lembrete de treino usa o horário configurado pelo aluno.

### Arquivos e mídia

Envio em duas etapas, direto ao armazenamento, para a API não carregar os bytes:

1. `POST /files/uploads` com `{ "purpose": "EXERCISE_MEDIA", "fileName": "supino.mp4", "contentType": "video/mp4", "sizeBytes": 4200000 }` devolve `{ "data": { "fileId": "...", "uploadUrl": "https://...", "headers": { "Content-Type": "video/mp4" }, "expiresAt": "..." } }`.
2. O cliente envia o arquivo com `PUT` para `uploadUrl`.
3. `POST /files/{fileId}/complete` confirma; a API verifica tipo e tamanho reais e responde `200`, ou `413 FILE_TOO_LARGE` / `415 UNSUPPORTED_MEDIA_TYPE`.

`purpose`: `EXERCISE_MEDIA` (JPG, PNG, MP4, até 10 MB) e `STUDENT_DOCUMENT` (PDF, até 10 MB).

| Método | Caminho | Quem | Descrição |
| --- | --- | --- | --- |
| POST | `/students/{studentId}/files` | Treinador | Anexa o arquivo enviado ao aluno: `{ "fileId": "...", "title": "Avaliação física · outubro", "shared": true }` |
| GET | `/students/{studentId}/files` | Treinador | Todos os arquivos do aluno |
| PATCH | `/files/{fileId}` | Treinador | Altera `title` ou `shared` |
| DELETE | `/files/{fileId}` | Treinador | Remove |
| GET | `/me/shared-files` | Aluno | Arquivos que o treinador marcou como compartilhados |
| GET | `/files/{fileId}/download-url` | Participante | URL assinada de download (expira em poucos minutos) |

O aluno só baixa arquivos com `shared: true` do seu próprio treinador; qualquer outro devolve `404`. Item da lista:

```json
{ "id": "0193d900-...", "title": "Avaliação física · outubro", "fileName": "avaliacao-outubro.pdf", "sizeBytes": 812345, "uploadedAt": "2026-10-31T12:00:00Z", "shared": true }
```

### WebSocket (`/v1/ws`)

Conexão autenticada com o token de acesso (enviado na abertura; a conexão é reaberta quando o token é renovado). Eventos do servidor para o cliente, todos com `{ "event": "...", "data": {...} }`:

| Evento | Quando | `data` |
| --- | --- | --- |
| `message.created` | Nova mensagem na conversa | O objeto de mensagem acima |
| `message.read` | O outro lado leu | `{ "conversationId", "upToMessageId", "readAt" }` |
| `notification.created` | Nova notificação | O objeto de notificação acima |
| `gamification.updated` | Semana fechada ou recalculada | O corpo de `GET /me/gamification` |
| `mesocycle.assigned` | Treinador ativou uma ficha | `{ "mesocycleId" }` |

O WebSocket só **avisa**; a fonte da verdade continua sendo a API REST. Após reconectar, o cliente chama `GET /sync/pull` (mobile) ou refaz as listas visíveis (web) para recuperar o que perdeu.

## 10. Catálogo de erros e mapa de telas

### Códigos de erro

O cliente decide o comportamento pelo `error.code`. Novos códigos podem ser adicionados sem aviso; o cliente trata qualquer código desconhecido pelo status HTTP.

| HTTP | `code` | Quando |
| --- | --- | --- |
| 400 | `MALFORMED_REQUEST` | JSON inválido ou cabeçalho obrigatório ausente |
| 401 | `UNAUTHENTICATED` | Sem token |
| 401 | `TOKEN_EXPIRED` | Token de acesso expirou; o cliente chama `/auth/refresh` e repete |
| 401 | `INVALID_CREDENTIALS` | E-mail ou senha incorretos (mensagem genérica) |
| 401 | `REFRESH_REUSED` | Refresh já usado; exige novo login |
| 403 | `FORBIDDEN` | Papel sem permissão para a ação |
| 403 | `EMAIL_NOT_VERIFIED` | E-mail ainda não confirmado |
| 404 | `NOT_FOUND` | Não existe ou pertence a outro usuário |
| 409 | `IDEMPOTENCY_CONFLICT` | Mesma chave com corpo diferente |
| 409 | `ALREADY_LINKED` | Aluno já tem treinador ativo |
| 409 | `LINK_NOT_ACTIVE` | Ação exige vínculo ativo |
| 409 | `INVITE_USED` | Convite já utilizado |
| 409 | `EXERCISE_IN_USE` | Exercício em ficha ativa |
| 409 | `EXERCISE_NAME_TAKEN` | Nome duplicado na biblioteca do dono |
| 409 | `ACTIVE_SESSION_EXISTS` | Já há uma sessão ativa do aluno |
| 409 | `SESSION_EDIT_WINDOW_EXPIRED` | Passaram mais de 24 horas da finalização |
| 409 | `MESOCYCLE_NOT_EDITABLE` | Tentativa de editar ficha que não é `DRAFT` |
| 410 | `INVITE_EXPIRED` | Convite passou de 7 dias |
| 410 | `INVITE_REVOKED` | Convite revogado |
| 413 | `FILE_TOO_LARGE` | Arquivo acima de 10 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Tipo de arquivo não aceito |
| 422 | `VALIDATION_ERROR` | Campo inválido; `details` lista os campos |
| 423 | `ACCOUNT_LOCKED` | 5 falhas de login seguidas; `details[0].retryAfterSeconds` |
| 426 | `UPDATE_REQUIRED` | Versão do app abaixo da mínima |
| 429 | `RATE_LIMITED` | Muitas requisições |
| 500 | `INTERNAL_ERROR` | Falha inesperada; use `traceId` para suporte |
| 503 | `SERVICE_UNAVAILABLE` | Manutenção; tente mais tarde |

### Mapa de telas para endpoints

Coluna "Chamadas" mostra o que cada tela do protótipo consome ao abrir ou ao agir.

| Tela | Plataforma | Chamadas |
| --- | --- | --- |
| Login, cadastro, recuperar senha | Web e mobile | `/auth/*`, `GET /me` |
| Convite (modal) | Web | `POST /invites`, `GET /invites`, `POST /invites/{id}/regenerate`, `DELETE /invites/{id}` |
| Aceitar convite | Mobile | `GET /invites/resolve`, `POST /invites/accept` |
| Dashboard | Web | `GET /dashboard`, `GET /sessions/timeline` |
| Meus alunos | Web | `GET /students` |
| Perfil do aluno: Visão Geral | Web | `GET /students/{id}`, `PUT /students/{id}/notes`, `GET /students/{id}/gamification` |
| Perfil do aluno: Ficha Atual | Web | `GET /mesocycles?studentId=&status=ACTIVE`, `POST /mesocycles/{id}/clone` |
| Perfil do aluno: Evolução | Web | `GET /students/{id}/progress` |
| Perfil do aluno: Anamnese | Web | `GET` e `PUT /students/{id}/anamnesis` |
| Perfil do aluno: Histórico | Web | `GET /mesocycles?studentId=`, `GET /students/{id}/body-measurements`, `GET /students/{id}/load-progression` |
| Construtor de fichas | Web | `GET /exercises`, `GET /catalog/*`, `GET /templates`, `POST` e `PUT /mesocycles`, `POST /mesocycles/{id}/activate`, `POST /templates` |
| Timeline e auditoria | Web | `GET /sessions/timeline`, `GET /sessions/{id}/audit` |
| Biblioteca | Web | `GET /exercises`, `DELETE /exercises/{id}` |
| Novo exercício | Web | `POST /files/uploads`, `POST /files/{id}/complete`, `POST /exercises`, `PUT /exercises/{id}/alternatives` |
| Gamificação (carteira) | Web | `GET /gamification/portfolio` |
| Mensagens e arquivos | Web | `/conversations/*`, `/students/{id}/files`, WebSocket |
| Início do aluno | Mobile e web do aluno | `GET /me/workouts/today`, `GET /me/gamification` |
| Meus treinos | Mobile | `GET /me/workouts`, `GET /me/workouts/{id}` |
| Treino ativo e sumário | Mobile | `GET /me/mesocycle/active` (offline), `POST /sync/push`, `GET /exercises/{id}/alternatives` |
| Evolução | Mobile | `GET /me/progress`, `GET /me/sessions`, `GET /me/sessions/{id}` |
| Treinador (chat e arquivos) | Mobile | `GET /me/trainer`, `/conversations/*`, `GET /me/shared-files`, `GET /files/{id}/download-url`, WebSocket |
| Gamificação do aluno | Mobile | `GET /me/gamification`, `GET /me/badges`, `GET /me/gamification/weeks/{weekStart}`, `GET /me/gamification/confirmations` |
| Perfil e configurações | Mobile | `GET` e `PATCH /me`, `/me/preferences`, `POST /me/body-measurements`, `POST /me/data-export`, `DELETE /me` |
| Notificações (sino) | Web e mobile | `GET /notifications`, `POST /notifications/read`, `GET /notifications/unread-count` |

### Pendências e decisões a confirmar

| Item | O que decidi | Impacto se mudar |
| --- | --- | --- |
| Edição de ficha ativa | Sempre via `clone` e nova ativação (RN05) | Se o treinador precisar ajustar "no lugar", haveria versão por sessão prescrita |
| Escrita da execução | Só por `/sync/push`, também online | Endpoints REST isolados exigiriam mais testes |
| Recálculo da semana corrente | Síncrono dentro de `SESSION_FINISH` | Se ficar lento, passar para job e confiar no evento de WebSocket (afeta RNF07) |
| Avaliações físicas na agenda | Fora desta versão (sem entidade) | Criar entidade e endpoints |
| Validade do token de acesso | 15 minutos | Ajustar conforme risco e experiência |
| Formato de erro | Formato próprio da seção 2 | Existe um padrão IETF para erros de API (Problem Details); não li a especificação, então confirme antes de adotá-lo |

A fonte final do contrato será a OpenAPI gerada pelo `fittrack-api`; este documento orienta o que implementar e deve ser atualizado quando a OpenAPI revelar divergências.
