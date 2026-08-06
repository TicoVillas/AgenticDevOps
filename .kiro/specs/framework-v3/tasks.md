# Tasks — Framework v3.0

## Identificação

- **Status:** FINAL
- **Fase:** spec
- **Modo:** REWORK_AFTER_CONTRACT_REVIEW
- **Estratégia:** Requirements-First
- **Projeto:** AgenticDevOps
- **Slug:** framework-v3
- **Origem:** `requirements.md` e `design.md` DRAFT; CR-001–CR-004 em rework
- **Execução planejada:** sequencial
- **Assurance:** HIGH_RISK
- **Última atualização:** 2026-07-28

## Regras de execução

- `framework/` deve ser uma nova raiz paralela delimitada no preflight.
- A Tarefa 1 começa confirmando Node.js major 24 e npm; ausência produz `NEEDS_STATE_VALIDATION`, sem instalar ou atualizar runtime automaticamente.
- Ferramentas usam Node.js 24.x, JavaScript ESM e npm; core, schemas, contratos, políticas e Skills permanecem tool-neutral.
- Dependências locais autorizadas são somente `ajv`, `ajv-formats` e `yaml`, pinadas exatamente em `package-lock.json`; instalação futura usa `npm ci --ignore-scripts` e nenhuma instalação global.
- Os comandos oficiais futuros, a partir de `framework/`, são `npm run validate` e `npm test`.
- `Kiro_v2_3_source/`, `Kiro_v2_4_source/` e `Analise_Workflow_v3.0.md` são read-only.
- Implementação não autoriza instalação global, migração real, Git/remoto, publicação, release ou deploy.
- Cada tarefa exige validação direcionada antes da próxima.
- Runtime diferente de Node.js 24.x, dependência material adicional ou path não autorizado exige `REQUIRES_REPLANNING`.

## Tarefa 1 — Estabelecer core e máquina de estados

**Requisitos:** REQ-001–006, NFR-001–004, BR-001–005

**Design:** Toolchain das ferramentas; Arquitetura; Core e máquina de estados; Boundaries

**Dependências:** nenhuma

**Áreas:** `framework/package.json`, `framework/package-lock.json`, `framework/core/`, schemas de core, ferramentas e testes de workflow

**Resultado:** toolchain local fica reproduzível e fases, papéis, status, transições, guardas e router possuem fontes canônicas validáveis e descrição humana coerente.

- [x] 1.1 Executar preflight de Node.js e npm: aceitar somente Node major 24 com npm disponível; caso contrário, encerrar `NEEDS_STATE_VALIDATION`, sem instalar ou atualizar.
- [x] 1.2 Criar `framework/package.json` ESM e `framework/package-lock.json`, com versões exatas de `ajv`, `ajv-formats` e `yaml` e scripts `validate` e `test`.
- [x] 1.3 Usar `node:test`, `node:crypto`, `node:fs` e `node:path` nas responsabilidades definidas; não introduzir TypeScript ou transpilação.
- [x] 1.4 Criar schemas para workflow, papéis e status.
- [x] 1.5 Criar `workflow.yaml`, `roles.yaml` e `statuses.yaml` com o fluxo v3.0 completo.
- [x] 1.6 Representar allowlist, assurance, autorizações e requisitos de sessão.
- [x] 1.7 Criar `workflow-core.md` e `WorkflowRouter.md` concisos, derivados semanticamente do core.
- [x] 1.8 Implementar `validate-workflow` com reachability, status e edges negativas.

**Validação:** `npm run validate` e `npm test`; preflight positivo e fixture de runtime ausente/incompatível; lockfile exato; fixtures válidas/inválidas; todas as fases alcançáveis; edges desconhecidas e status inválidos rejeitados; comparação com fluxo v2.4.

**Critério de interrupção:** Node major diferente de 24, npm ausente, dependência adicional necessária ou qualquer fase/gate da v2.4 sem representação.

## Tarefa 2 — Criar contratos e schemas compartilhados

**Requisitos:** REQ-007, REQ-013–014, REQ-019, REQ-032, REQ-037–038, REQ-050, NFR-001–002, NFR-004–006

**Design:** Boundaries; Perfil técnico; Evidência e manifests; Validators

**Dependências:** Tarefa 1

**Áreas:** `framework/contracts/`, `framework/tools/`, `framework/tests/contracts/`

**Resultado:** artefatos, findings, evidências, perfis e manifests possuem schemas versionados e templates separados antes de seus consumidores.

- [x] 2.1 Criar `evidence-envelope.schema.yaml` e schema único de finding/warning.
- [x] 2.2 Criar schemas de requirements, design, tasks, execution brief, reviews e evidências.
- [x] 2.3 Criar schemas de perfil-base e override, incluindo os sete campos obrigatórios do override.
- [x] 2.4 Criar schemas de `dry-run-manifest` e `transition-manifest` reutilizando o envelope.
- [x] 2.5 Extrair templates humanos sem duplicar regras dos schemas.
- [x] 2.6 Implementar `validate-artifacts` e fixtures positivas/negativas.
- [x] 2.7 Implementar geração/verificação de `framework.lock`.

**Validação:** composição de schemas, campos obrigatórios, sanitização, hashes e referências; templates sem conflito com schemas; fixtures estruturais de override válidas/inválidas disponíveis para a Tarefa 4.

## Tarefa 3 — Refatorar políticas para fontes canônicas únicas

**Requisitos:** REQ-007–009, REQ-018, REQ-025, REQ-030, ACC-015–016, NFR-003–007

**Design:** Boundaries; Políticas canônicas e carregamento progressivo; Segurança; Compatibilidade

**Dependências:** Tarefas 1–2

**Áreas:** `framework/policies/`, carregador de contexto, testes de políticas/ownership/duplicação

**Resultado:** políticas tool-neutral existem como fontes únicas antes dos classificadores e consumers; capability selection e carregamento progressivo são contratos testáveis.

- [x] 3.1 Criar `CapabilitySelectionPolicy.md` baseada somente em capacidades, esforço e fallback, sem catálogo ou nome concreto de modelo.
- [x] 3.2 Criar `ContextPolicy.md` com a sequência obrigatória `metadados → Skill aplicável → referências necessárias` e proibição de referências não solicitadas.
- [x] 3.3 Estabelecer Execution Environment, Git Safety, Secure Development e High Risk como fontes normativas únicas, separando regras universais de perfis de host/superfície.
- [x] 3.4 Mapear controles de segurança a outcomes e riscos agentic, preservando proporcionalidade.
- [x] 3.5 Implementar `detect-duplicate-rules` e relatório de ownership antes de criar classificadores consumidores.
- [x] 3.6 Criar teste de contrato REQ-008/ACC-015 que falha diante de catálogo/nome concreto no core ou políticas e aceita nomes somente em adapters.
- [x] 3.7 Criar teste instrumentado REQ-009/ACC-016 que prova a ordem de carregamento e falha diante de referência não solicitada.

**Validação:** scans de duplicação e tool coupling; matriz de preservação v2.4; testes dedicados ACC-015 e ACC-016 com casos positivos e negativos.

**Critério de interrupção:** classificador implementado antes da política fonte, nome concreto de modelo fora de adapter ou carregamento de contexto não solicitado.

## Tarefa 4 — Implementar perfil técnico e assurance proporcional

**Requisitos:** REQ-019–030, ACC-005–006, NFR-002

**Design:** Perfil técnico; Assurance; Políticas canônicas

**Dependências:** Tarefas 1–3

**Áreas:** schema de perfil/override, matriz de regras, validator e testes de políticas

**Resultado:** exposição, impacto, override e assurance são validados e classificados por regras objetivas derivadas das políticas canônicas.

- [x] 4.1 Finalizar `application-profile.schema.yaml` com os enums confirmados.
- [x] 4.2 Definir `.agentic/application-profile.yaml` e o override por entrega com `scope`, `rationale`, `authorization_ref`, `authorized_at`, `expires_at`, `base_profile_hash` e `source_evidence`.
- [x] 4.3 Validar fail-closed: rejeitar override sem autorização, escopo, racional ou expiração válidos, bem como hash-base divergente ou evidência ausente.
- [x] 4.4 Implementar matriz 4×4 e triggers contextuais sem confiança implícita em rede interna.
- [x] 4.5 Implementar regras `LIGHT`, `STANDARD` e `HIGH_RISK` e elevação `LIGHT → STANDARD` por finding material/guarda falha.
- [x] 4.6 Implementar `validate-application-profile` e casos de controles insuficientes/excessivos.

**Validação:** 16 combinações exposição×impacto; override válido; casos negativos isolados para cada um dos sete campos e para autorização/escopo/racional/expiração sem validade; cenários LOW–CRITICAL.

**Critério de interrupção:** combinação não determinística, redução de baseline por localização interna ou override aceito sem todos os controles definidos.

## Tarefa 5 — Implementar dry-run fail-closed

**Requisitos:** REQ-031–036, REQ-038, ACC-007, NFR-001–002

**Design:** Dry-run e auto-validação; Evidência

**Dependências:** Tarefas 1–4

**Áreas:** schemas/manifests, classificador, validator e testes

**Resultado:** dry-runs recebem decisão determinística e somente operações elegíveis podem autoaplicar.

- [x] 5.1 Implementar normalização de risco, reversibilidade, ambiguidade e blast radius a partir das políticas já canônicas.
- [x] 5.2 Implementar guardas de autorização, path, snapshot/hash, determinismo, idempotência e equivalência.
- [x] 5.3 Produzir `AUTO_APPLY_ELIGIBLE`, `CHECKPOINT_REQUIRED` ou `BLOCKED` com evidência explicável.
- [x] 5.4 Impedir autoaplicação quando qualquer guarda obrigatória falhar.
- [x] 5.5 Cobrir efeito parcial, retry, ambiente compartilhado/produção, dados/segredos e operação externa.

**Validação:** tabela de decisão e testes negativos; falsos elegíveis iguais a zero nos cenários críticos.

**Checkpoint:** qualquer proposta de autoaplicação fora dos critérios confirmados exige replanejamento.

## Tarefa 6 — Implementar chaining e topologia de sessões

**Requisitos:** REQ-037–043, ACC-004, ACC-008, BR-001–005

**Design:** Chaining e topologia; Core

**Dependências:** Tarefas 1–5

**Áreas:** transition validator, session routing e testes de workflow

**Resultado:** somente edges automáticas autorizadas encadeiam, preservando continuidade, independência e as transições humanas do fluxo completo.

- [x] 6.1 Implementar a allowlist automática inicial exatamente como contratada.
- [x] 6.2 Validar autorização, artefato final, hashes, decisão pendente, assurance, evidência e sessão.
- [x] 6.3 Implementar cross-session routing obrigatório para primeira revisão/validação.
- [x] 6.4 Implementar retorno à sessão original para rework/follow-up/correção/revalidação.
- [x] 6.5 Preservar revisão final `CONSULTING` e entrada autorizada em `delivery-closeout` como transições humanas explícitas, não edges automáticas.
- [x] 6.6 Impedir ampliação de escopo, paths, permissões, Git/remoto ou autoridade.
- [x] 6.7 Emitir transition manifest e decisões `CHAINED`, `CHECKPOINT_REQUIRED` ou `BLOCKED`.

**Validação:** cenários positivos e negativos por edge; cenários explícitos de revisão final e closeout autorizado; zero violações de topologia e autorizações inferidas.

## Tarefa 7 — Migrar Skills para progressive disclosure

**Requisitos:** REQ-009–014, REQ-018, ACC-003, ACC-016, NFR-005

**Design:** Políticas canônicas e carregamento progressivo; Skills e geração

**Dependências:** Tarefas 1–6

**Áreas:** `framework/skills/`, geradores, referências e testes

**Resultado:** dez Skills preservadas, cada uma com uma fonte canônica concisa, referências condicionais e formatos alternativos gerados.

- [x] 7.1 Migrar cada Skill para `skills/<slug>/SKILL.md` com somente fluxo essencial.
- [x] 7.2 Extrair templates, exemplos e detalhes condicionais para referências/assets/scripts.
- [x] 7.3 Substituir regras copiadas por referências a core/policies/contracts.
- [x] 7.4 Implementar `validate-skills` e warning de aproximadamente 500 linhas.
- [x] 7.5 Implementar gerador de formatos compatíveis e verificação contra `framework.lock`.
- [x] 7.6 Integrar o carregador progressivo e executar ACC-016 para cada padrão de referência condicional.
- [x] 7.7 Provar que cópia gerada alterada ou referência não solicitada carregada falha.

**Validação:** estrutura das dez Skills, links, tamanho, equivalência funcional, ausência de segunda fonte manual e traces instrumentados da ordem `metadados → Skill → referências necessárias`.

## Tarefa 8 — Implementar adapters e perfis de resposta

**Requisitos:** REQ-008, REQ-044–048, ACC-002, ACC-009, ACC-015, NFR-003

**Design:** Adapters; Políticas canônicas

**Dependências:** Tarefas 1–7

**Áreas:** `framework/adapters/`, testes de contrato e handoff

**Resultado:** ChatGPT, Codex, Claude e Kiro resolvem capacidades e nomes concretos somente nos adapters, executando o mesmo core sem alteração semântica.

- [x] 8.1 Implementar adapter ChatGPT e perfis `DELTA`, `DECISION`, `HANDOFF`, `REVIEW`, `RESEARCH`, `FULL_ARTIFACT`.
- [x] 8.2 Aplicar budgets flexíveis e detecção de informação/metadados duplicados.
- [x] 8.3 Implementar mappings Codex/Claude por capacidade, esforço e fallback, mantendo nomes concretos confinados aos adapters.
- [x] 8.4 Implementar adapter Kiro sempre com agente `Default` e `.kiro/` como compatibilidade.
- [x] 8.5 Implementar `validate-adapters` e `validate-handoff`.
- [x] 8.6 Executar ACC-015 ponta a ponta: core sem catálogo/nome e resolução concreta somente pelo adapter.

**Validação:** contract tests, snapshots de resposta e scan que rejeita nomes concretos fora de adapters/fixtures de compatibilidade permitidas.

## Tarefa 9 — Criar Decision Records e compatibilidade versionada

**Requisitos:** REQ-015–018, REQ-049, ACC-010–011

**Design:** Decision Records; Compatibilidade e lifecycle

**Dependências:** Tarefas 1–8

**Áreas:** `framework/decisions/`, adapter Kiro, aliases e testes de sources

**Resultado:** decisões duráveis e lifecycle v3.0/v3.1/v3.2 ficam versionados e verificáveis.

- [x] 9.1 Criar DEC-001 a DEC-004 conforme design.
- [x] 9.2 Gerar alias `DiscoveryRouter.md` com warning na v3.0.
- [x] 9.3 Rejeitar novos consumidores legados e exigir migração na v3.1.
- [x] 9.4 Implementar scan que bloqueia remoção na v3.2 enquanto houver referência/consumidor.
- [x] 9.5 Validar que `.agentic/` é canônico e `.kiro/` não contém norma independente.

**Validação:** fixtures de consumidores legados, lifecycle por versão e links dos Decision Records.

## Tarefa 10 — Consolidar evals, equivalência e pacote local

**Requisitos:** REQ-050–054, ACC-001–016, NFR-001–007

**Design:** Estratégia de testes; Rollout e rollback; Observabilidade

**Dependências:** Tarefas 1–9

**Áreas:** `framework/tests/`, `framework/tools/`, `framework/framework.lock`, pacote local não instalado

**Resultado:** a distribuição v3.0 é validada contra requisitos e comportamento v2.4, sem operação real.

- [x] 10.1 Executar `npm run validate` e `npm test` cobrindo schemas, core, políticas, Skills, adapters e cenários.
- [x] 10.2 Executar evals de roteamento, assurance, dry-run, chaining, sessões e respostas.
- [x] 10.3 Reexecutar os critérios dedicados ACC-015 e ACC-016 e os casos negativos de override CR-004.
- [x] 10.4 Gerar matriz requisito → implementação → teste → evidência.
- [x] 10.5 Gerar matriz de equivalência v2.4 → v3.0 e classificar diferenças.
- [x] 10.6 Medir handoffs/checkpoints e comprovar redução sem perda de controle.
- [x] 10.7 Gerar lock/hashes e pacote local reproduzível, sem instalar ou publicar.
- [x] 10.8 Produzir `EXECUTION.md` com operações reais explicitamente não executadas.

**Validação:** suite completa exit code 0; nenhuma diferença material não autorizada; hashes reproduzíveis; fontes preservadas; matriz inclui REQ-008→ACC-015 e REQ-009→ACC-016.

**Checkpoint:** instalação global, migração de projeto, remoção efetiva de aliases, Git/remoto, publicação, release e deploy permanecem fases futuras autorizadas separadamente.

## Matriz compacta de rastreabilidade

| Tasks | Requisitos e critérios principais | Evidência esperada |
|---|---|---|
| 1 | REQ-001–006; CR-001 | preflight Node 24/npm, manifests/lock, workflow fixtures, reachability |
| 2 | REQ-007, 013–014, 019, 032, 037–038, 050 | schema reports, templates, override schema, lock |
| 3 | REQ-007–009, 018, 025, 030; ACC-015–016 | ownership, duplicate/tool-coupling reports, testes dedicados |
| 4 | REQ-019–030; CR-004 | matriz 4×4, assurance tests, fixtures dos sete campos do override |
| 5 | REQ-031–036 | dry-run decision tests e manifests |
| 6 | REQ-037–043; CR-005 | transition/session scenarios, revisão final e closeout humano preservados |
| 7 | REQ-009–014, 018; ACC-016 | Skill validation, traces progressivos e generated-source checks |
| 8 | REQ-008, 044–048; ACC-015 | adapter contracts, scan de nomes e response snapshots |
| 9 | REQ-015–018, 049 | Decision Records e lifecycle fixtures |
| 10 | REQ-050–054; ACC-001–016 | suite, matrizes, package hashes e `EXECUTION.md` |

## Operações não incluídas

Branch, staging, commit, push, PR, merge, exclusão de branch, tag, release, deploy, instalação global, migração real e remoção real de compatibilidade não são tasks desta execução.
