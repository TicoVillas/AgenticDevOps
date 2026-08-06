# Execution Brief — Layout global manifest-driven do framework v3

Status: FINAL_READY_FOR_EXECUTION  
Fase: spec  
Projeto: AgenticDevOps  
Slug: framework-v3-global-bootstrap-layout  
Estratégia: Design-First  
Linha de sessão: engenharia e autoria  
Sessão: engineering-author/framework-v3  
Última atualização: 2026-07-28

## Estado do contrato

Contrato consolidado como FINAL pelo Contract Review round-01, decisão vigente `APPROVED_WITH_NON_MATERIAL_FIXES` (CR-GBL-001 aplicado; CR-GBL-002 warning aceito). Este brief está `FINAL_READY_FOR_EXECUTION`. **A implementação local continua não autorizada**: exige autorização explícita e separada do usuário e reconfirmação de working tree/paths/escritor. A execução local não autoriza operação global, restart, Etapa B, piloto, Git ou remoto.

## Artefatos de referência

- `.kiro/specs/framework-v3-global-bootstrap-layout/discovery.md` — `APPROVED_FOR_SPEC`;
- `.kiro/specs/framework-v3-global-bootstrap-layout/requirements.md` — `FINAL`;
- `.kiro/specs/framework-v3-global-bootstrap-layout/design.md` — `FINAL`;
- `.kiro/specs/framework-v3-global-bootstrap-layout/tasks.md` — `FINAL`;
- `.kiro/specs/framework-v3-global-bootstrap-layout/reviews/contract-review.md` — `APPROVED_WITH_NON_MATERIAL_FIXES`;
- `framework/skills/execute-contract/SKILL.md` — Skill futura da execução.

## Objetivo

Implementar localmente o contrato de distribuição Kiro manifest-driven e provar, apenas em roots sintéticas, que o framework v3 consegue:

- declarar exatamente 64 destinos globais gerenciados;
- gerar um steering global fino e determinístico;
- validar catálogo, mapa, lock, payload e pacote;
- planejar sem mutação;
- classificar conflitos fail-closed;
- modelar backup, journal, receipt, apply, resume e rollback;
- garantir self-update final e hard stop `RESTART_REQUIRED`;
- definir uma Etapa B pós-restart separada.

## Norte técnico

- `source_catalog` classifica toda fonte locked.
- `managed_items` contém exatamente os 64 itens da tabela vinculante de `design.md`.
- O 64º item é `adapters/kiro/generated/agentic-workflow.md` → `~/.kiro/steering/agentic-workflow.md`.
- Novos artefatos de control plane permanecem SOURCE_ONLY/BUILD_TEST_ONLY.
- Planner é read-only e não compartilha capacidade de escrita.
- Executor transacional recebe roots injetadas e, nesta entrega, só é exercitado em temporários sintéticos.
- `workflow-bootstrap/SKILL.md` é o único self-update e a última escrita conceitual da Etapa A.
- Receipt pré-restart não antecipa self-update; conclusão pertence à Etapa B.
- O core continua tool-neutral; semântica/path Kiro fica no adapter/manifest.

## Tarefas candidatas à autorização após review

As 12 tasks de `tasks.md`, na ordem contratada:

1. contratos de distribuição e evidência operacional;
2. catálogo e mapa Kiro 64/64;
3. steering fino determinístico;
4. validator estrutural/semântico;
5. snapshot e estados;
6. planner/dry-run read-only;
7. backup/journal/receipt em roots injetadas;
8. apply transacional em roots sintéticas;
9. resume/rollback sintéticos;
10. workflow-bootstrap, self-update final e contrato da Etapa B;
11. matriz de testes e regressões;
12. geração, lock, pacote, validação e evidência.

A autorização futura pode delimitar lotes progressivos, mas não pode omitir dependências nem transformar operações reais em subtask local.

## Tarefas e operações não autorizadas

- escrever, instalar, remover, restaurar, chmod/chown ou criar arquivo em `/home/villas/.kiro/**` ou outra raiz global real;
- executar Etapa A real;
- criar backup, journal ou receipt real de instalação;
- retirar/restaurar os nove steering v2.3 reais;
- executar self-update global real;
- reiniciar Kiro ou continuar automaticamente após `RESTART_REQUIRED`;
- executar Etapa B real;
- migrar `AgenticDevOps` em `PROJECT_UPDATE`;
- alterar/ativar ChatGPT Project ou instalar adapters ChatGPT/Codex/Claude;
- alterar `.agentic` de projeto;
- modificar `Kiro_v2_3_source/**`, `Kiro_v2_4_source/**`, `Analise_Workflow_v3.0.md` ou `.kiro/specs/framework-v3/**`;
- adicionar dependência, mudar arquitetura material ou ampliar o mapa sem replanejamento;
- Git, branch, staging, commit, push, PR, merge, tag, release ou deploy.

## Áreas e arquivos principais esperados

### Contratos e adapter

- `framework/adapters/kiro/distribution-manifest.yaml`;
- `framework/adapters/kiro/templates/agentic-workflow.md`;
- `framework/adapters/kiro/generated/agentic-workflow.md`;
- `framework/contracts/schemas/distribution-manifest.schema.yaml`;
- schemas/templates operacionais mínimos justificados.

### Tooling

- `framework/tools/lib/distribution.mjs`;
- `framework/tools/lib/installation.mjs`;
- `framework/tools/validate-distribution.mjs`;
- `framework/tools/validate-all.mjs`;
- integração mínima com dry-run, geradores e empacotamento existentes.

### Skill

- `framework/skills/workflow-bootstrap/SKILL.md`;
- `framework/skills/workflow-bootstrap/references/migration.md` quando necessário.

### Testes e integridade

- `framework/tests/distribution/**`;
- testes existentes diretamente afetados;
- `framework/framework.lock` somente após estabilização dos arquivos;
- package metadata/lockfile somente se a integração aprovada realmente exigir mudança;
- `.kiro/specs/framework-v3-global-bootstrap-layout/evidence/execution/round-N/EXECUTION.md`.

A lista é uma allowlist orientativa, não licença para alterar todo path. Arquivo adicional exige relação direta com task/requisito; fora dessa relação, requer checkpoint ou replanejamento.

## Comportamentos preservados

- 5 core, 10 policies, 25 contracts, 20 itens de Skills e 3 itens do adapter Kiro permanecem no mapa aprovado de 63.
- `DiscoveryRouter.md` preserva lifecycle v3.0/v3.1/v3.2.
- `npm run validate` e `npm test` continuam comandos oficiais.
- Node.js 24.x, JavaScript ESM, `node:test`, `node:fs`, `node:path`, `node:crypto`, Ajv e YAML permanecem a base.
- Nenhuma dependência nova é prevista.
- Fontes v2.3/v2.4 e análise v3 permanecem read-only.
- Unmanaged, customizações e diretórios compartilhados são preservados.
- Git não é condição de rollback operacional.

## Fora do escopo

- qualquer efeito em ambiente global/real;
- prova runtime do loader após restart;
- operação de rollback real;
- migração de projeto;
- adapters não Kiro;
- Git e delivery closeout;
- release, deploy ou operação externa.

## Segurança

Aplicar os requisitos SEC-001–SEC-009 e os boundaries de `design.md`.

Controles obrigatórios na execução local:

- raízes absolutas e filesystem injetados;
- guarda explícita que rejeita `/home/villas/.kiro`, `$HOME/.kiro` e raiz global resolvida nos testes/apply local;
- normalização, `lstat`, no-follow, containment e rejeição de traversal/escape;
- hash e provenance antes de classificar ou planejar;
- fail-closed para unmanaged, divergente, symlink, tipo inesperado e efeito parcial incerto;
- nenhum segredo, credencial ou dado pessoal em fixtures/evidência;
- sem elevação de privilégio;
- sem rede por conveniência;
- sem dependência nova;
- revisão de generated outputs, lock e pacote.

## Alto risco

O alto risco pertence à futura operação global, não concede permissão nesta execução local. A implementação deve fornecer mecanismos e testes para:

- snapshot vinculado à autorização;
- backup verificável;
- journal/WAL e receipt fiel;
- idempotência;
- falha parcial;
- rollback;
- critérios de interrupção;
- self-update final;
- restart e Etapa B separados.

Nenhum teste ofensivo ou operacional pode usar a raiz global real.

## Validações obrigatórias da futura execução

### Progressivas

- testes direcionados por task;
- validação de schemas/manifest após Tasks 1–4;
- testes read-only após Tasks 5–6;
- testes transacionais em temporários após Tasks 7–10;
- matriz completa na Task 11.

### Finais

Executar a partir de `framework/`, quando o runtime já estiver disponível:

- `npm run validate`;
- `npm test`;
- comando oficial de geração/lock;
- comando oficial de pacote e inspeção de conteúdo;
- revisão de paths/diff e checagem de integridade.

Sem Node major 24 ou npm: registrar `NEEDS_STATE_VALIDATION`; não instalar ou atualizar runtime automaticamente.

### Evidência mínima

- comandos, diretório, exit codes e efeitos;
- testes positivos e negativos por boundary;
- contagem 64/64 e nove retirements;
- generated hash determinístico;
- planner sem mutação;
- fault injection, resume, rollback e hard stop;
- lock/pacote reconciliados;
- global real, restart, Etapa B e piloto marcados `NOT_EXECUTED`.

## Checkpoints

### CP-01 — Contract Review

Necessário antes de qualquer implementação. Deve aprovar rastreabilidade, mapa 64, schemas, tasks, segurança, testabilidade e separação das operações reais.

### CP-02 — Divergência material durante execução

Usar `REQUIRES_REPLANNING` se surgir novo destino, classe, dependência, adapter, arquitetura, permissão, operação real, mudança do loader ou impossibilidade de garantir self-update final.

### CP-03 — Arquivo fora da allowlist

Explicar path, requisito, impacto e materialidade; obter autorização se não for derivação local não material já coberta.

### CP-04 — Encerramento da implementação local

Somente após testes, validação ampla, lock/pacote, diff e `EXECUTION.md`. Não autoriza instalação global.

### CP-05 — Operação global futura

Fora desta execução. Exige novo preflight, plano, snapshot, backup, rollback, modo Supervised e autorização específica para Etapa A.

## Critérios de interrupção

- discovery/contrato/artefatos não finais ou review não aprovado;
- writer concorrente ou alterações preexistentes não atribuíveis;
- tentativa de tocar root global real;
- mapa diferente de 64 ou novo destino;
- fonte/manifest/lock/pacote divergente não explicado;
- necessidade de dependência nova;
- estado de filesystem não classificável;
- symlink, escape, unmanaged ou tipo inesperado tratado como mutável;
- backup/receipt sem fidelidade demonstrável;
- escrita posterior ao self-update;
- validação que exija restart/global real para ser declarada localmente aprovada;
- mudança material de comportamento, arquitetura, segurança ou autorização.

## Divergências que exigem replanejamento

- loader real do Kiro refutar o entrypoint aprovado;
- 64º item não ser suficiente ou exigir conteúdo normativo duplicado;
- necessidade de instalar novos schemas/manifests/tooling no global;
- necessidade de coexistência com os nove steering v2.3;
- self-update não puder ser última escrita;
- rollback exigir Git, privilégio ou remoção ampla;
- adapter não Kiro tornar-se parte da operação;
- piloto precisar ser acoplado à instalação.

## Seleção recomendada para o Contract Review

Agente executor: Kiro  
Superfície: IDE  
Host: Linux  
Fase: contract-review  
Skill: `contract-review`  
Família de LLM: Cloud Opus  
Modelo LLM: Claude Opus 4.8  
Esforço: Max  
Agente/Workflow Kiro: Default  
Modo de execução: Autopilot  
Estratégia de sessão: Nova sessão independente  
Sessão de destino: `contract-assurance/framework-v3-global-bootstrap-layout/round-01`  
Contratos: ContextPolicy, GitSafetyPolicy, ArtifactContract, EvidenceAndFeedbackContract, SecureDevelopmentPolicy, ModelSelectionPolicy  
Overlay: HighRiskOverlay.md

Fallback:

- Família: Cloud Opus;
- Modelo: Claude Opus 4.7 ou equivalente Active exibido no seletor;
- Esforço: Max, quando suportado;
- Condição: apenas indisponibilidade confirmada do Claude Opus 4.8 e equivalência de capacidade confirmada antes da rodada; sem downgrade silencioso. Se não houver equivalente aprovado, `BLOCKED`.

Disponibilidade: confirmar no seletor real do Kiro.  
Catálogo: seletor real prevalece; fallback hard-coded global revisado em 2026-07-24.

## Seleção provisória para execução após review

A seleção final pertence ao Contract Reviewer. Recomendação não vinculante:

- Executor: Kiro;
- Superfície/Host: IDE / Linux;
- Família/Modelo: Codex / GPT-5.6 Sol;
- Esforço: High;
- Agente/Workflow: Default;
- Modo: Autopilot para implementação local, com checkpoints definidos;
- Estratégia: retomar `engineering-author/framework-v3`;
- Fallback: Cloud Opus / Claude Opus 4.8 / High, somente se selecionado explicitamente pelo reviewer.

A operação global futura, se autorizada em outra fase, deve usar modo Supervised e seleção reavaliada para alto risco.

## Ações Git e remotas

Nenhuma. Implementação não autoriza staging, commit, push, PR, merge, tag, release, deploy ou alteração externa.

Aplique `ExecutionEnvironmentPolicy.md` para resolver host, shell, raiz global, paths, temporários, retries e evidência operacional.

## Retorno esperado da futura execução

- status `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `PARTIAL`, `BLOCKED` ou `REQUIRES_REPLANNING`;
- `EXECUTION.md` factual;
- tasks marcadas conforme resultado;
- arquivos alterados e validações;
- divergências e riscos residuais;
- estado Git conhecido, ainda que `NOT_APPLICABLE_NO_REPOSITORY`;
- seleção de nova sessão independente para `validate-delivery`;
- confirmação explícita de que global real, restart, Etapa B, piloto, Git e remoto não foram executados.
