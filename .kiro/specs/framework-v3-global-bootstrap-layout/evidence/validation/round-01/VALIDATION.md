# Validation — Layout global manifest-driven do framework v3

## Identificação

- **Fase:** validate-delivery · **Tipo:** VALIDATION · **Modo operacional:** INITIAL_VALIDATION
- **Papel:** DELIVERY_ASSURANCE
- **Projeto:** AgenticDevOps · **Slug:** framework-v3-global-bootstrap-layout · **Rodada:** round-01
- **Agente executor:** Kiro · **Superfície/Host:** IDE / Linux (x86_64) · **Shell:** Bash
- **Agente/Workflow Kiro:** Default · **Modo:** Autopilot (validações locais read-only/temporárias)
- **Overlay:** HighRiskOverlay como critério proporcional à futura operação global (nenhuma operação global autorizada nesta rodada)
- **Data:** 2026-08-02

## Sessão e independência

- **Sessão executora (não retomada):** `engineering-author/framework-v3`.
- **Sessão validadora:** `delivery-assurance/framework-v3-global-bootstrap-layout/round-01` (nova, independente).
- **Independência confirmada:** sim. `EXECUTION.md`, hashes, contagens e alegações tratados como `REPORTED` até confronto independente.
- **Não usados como autoridade:** conversa executora, memória da autoria, resumos, checkboxes isolados, afirmação de que testes passaram, hash relatado sem reprodução.

## Modelo resolvido

Família Cloud Opus; **Claude Opus 4.8 / Max** confirmado no seletor real; sem fallback; sem downgrade.

## Contrato e estados verificados

| Artefato | Esperado | Observado | Verificação |
|---|---|---|---|
| discovery.md | APPROVED_FOR_SPEC | APPROVED_FOR_SPEC | CONFIRMED_DIRECTLY |
| requirements.md | FINAL | FINAL | CONFIRMED_DIRECTLY |
| design.md | FINAL | FINAL | CONFIRMED_DIRECTLY |
| tasks.md | FINAL (Tasks 1–12 concluídas) | FINAL; 12 tarefas; subtarefas `[x]` | CONFIRMED_DIRECTLY |
| execution-brief.md | FINAL_READY_FOR_EXECUTION | FINAL_READY_FOR_EXECUTION | CONFIRMED_DIRECTLY |
| contract-review.md | APPROVED_WITH_NON_MATERIAL_FIXES | APPROVED_WITH_NON_MATERIAL_FIXES | CONFIRMED_DIRECTLY |
| EXECUTION.md | COMPLETED_WITH_WARNINGS | COMPLETED_WITH_WARNINGS (relato) | CONFIRMED_DIRECTLY como REPORTED |

## Preflight independente

- Raiz `/home/villas/Projects/AgenticDevOps` confirmada; host Linux x86_64; Node `v24.18.0`, npm `11.16.0`. CONFIRMED_DIRECTLY.
- **Sem `.git` na raiz; Git não inicializado.** CONFIRMED_DIRECTLY.
- Writer único (esta sessão), sem operação em andamento.
- Único artefato de execução: `evidence/execution/round-01/EXECUTION.md`. Sem `validation/`/`corrections/` prévios.
- **`framework.lock`: 164/164 verificados por SHA-256** (0 ausentes, 0 divergentes); único arquivo não-locked = o próprio `framework.lock` (sem drift).
- **Sentinela global ANTES:** `~/.kiro/steering` (9) + `~/.kiro/skills` (10) = **19 arquivos**, digest `f54df075…` capturado.
- Fontes protegidas preservadas: `Kiro_v2_3_source/` (2026-07-24), `Kiro_v2_4_source/` (2026-07-27), `Analise_Workflow_v3.0.md` (2026-07-28 21:09), `AGENTS.md` (2026-07-28 22:35), `.kiro/specs/framework-v3/` (8 arquivos) — anteriores ao build e não modificados.

## Atribuição do delta

| Alvo | Classe | Origem | Resultado |
|---|---|---|---|
| `framework/**` (164 fontes: +21 novas vs 143; `.tgz`; `node_modules/`) | DELIVERY | execução round-01 | Atribuído à entrega |
| `tasks.md` (tokens de checkbox; 12 tarefas intactas) | DELIVERY | execução | Dentro do escopo |
| `evidence/execution/round-01/EXECUTION.md` | DELIVERY | execução | Relato |
| v2.3/v2.4/Analise/AGENTS/`framework-v3/**` | PROTECTED | — | Preservados (mtime/inventário) |
| `~/.kiro/**` | GLOBAL | — | Intocado (sentinela) |
| `node_modules/` | GENERATED | `npm ci` (execução) | Fora das 164 fontes; excluído do pacote |

Nenhuma alteração fora do contrato detectada.

## Revisão da implementação

Novos/alterados confrontados diretamente: `adapters/kiro/distribution-manifest.yaml`; `adapters/kiro/templates/agentic-workflow.md` + `generated/agentic-workflow.md`; quatro schemas (`distribution-manifest`, `distribution-backup-manifest`, `installation-journal`, `installation-receipt`); `tools/lib/distribution.mjs`; `tools/lib/installation.mjs`; `tools/validate-distribution.mjs`; integração em `validate-all.mjs` (12º check); `skills/workflow-bootstrap/SKILL.md` (+ `references/migration.md`); `generated/skills/workflow-bootstrap.md`; 10 testes em `tests/distribution/**`; `package.json`; `framework.lock`; pacote `.tgz`. Correspondem às Tasks 1–12; sem alteração fora do contrato.

`get_diagnostics` (independente): **zero** issues em `tasks.md`, `distribution.mjs`, `installation.mjs`, `validate-distribution.mjs`.

## Contrato de distribuição (comprovação independente)

- **`source_catalog` cobre todas as 164 fontes locked**; exatamente **cinco classes**: `GLOBAL_KIRO_MANAGED`=62, `GENERATED_PACKAGE_CONTENT`=15, `SOURCE_ONLY`=57, `BUILD_TEST_ONLY`=28, `PROJECT_TEMPLATE`=2 (=164). `LEGACY_ACTIVE_CONFLICT` é estado, não classe.
- **64 managed items · 64 destinos únicos** (contagem independente = 64/64); decomposição do validador **5 + 10 + 25 + 20 + 3 + 1 = 64**.
- Os 64 managed = 62 GKM + 2 GPC (alias `DiscoveryRouter.md` + steering `agentic-workflow.md`); os 13 GPC restantes (10 skills geradas + 3 relatórios) e todos SOURCE_ONLY/BUILD_TEST_ONLY/PROJECT_TEMPLATE **não** têm destino global.
- **Exatamente 9 retirements** = os 9 steering v2.3 reais (`workflow-core.md` + 8 contratos), batendo byte a byte com a sentinela.
- **Exatamente 1 steering global** (`steering/agentic-workflow.md`, `loader_role` entrypoint) e **exatamente 1 self-update** (`skill-bootstrap`, `apply_phase: SELF_UPDATE`, `depends_on` os 63 demais → **topologicamente final**).
- Nenhum adapter não-Kiro possui destino; nenhum novo SOURCE_ONLY/BUILD_TEST_ONLY entra nos 64 (os 4 novos schemas são **SOURCE_ONLY**, sem managed item).
- **Integridade do manifest externa via `framework.lock`** (`hash_mode: FRAMEWORK_LOCK_EXTERNAL`, `class: SOURCE_ONLY`) — **sem auto-hash recursivo** (CR-GBL-001 implementado).
- Ordem gerar → lock → pacote determinística (reprodutibilidade abaixo). Sem mapa procedural paralelo na Skill (a Skill consome o planner validado).

## Steering e loader

- Geração determinística validada por `tests/distribution/steering.test.mjs` (reexecutado, aprovado).
- Gerado: `inclusion: always` (1), comentário de provenance/DO NOT EDIT (1), **7 linhas** (fino), **0** paths absolutos, **0** nomes legados reutilizados; referências relativas `../core/WorkflowRouter.md` e `../skills/` que resolvem corretamente a partir de `~/.kiro/steering/`; sem workflow/políticas/contratos/Skills copiados integralmente.
- Loader Kiro real: **NOT_EXECUTED — requer Etapa A, restart e Etapa B autorizadas.**

## CR-GBL-002 — teste anti-órfão (reconfronto independente)

- Os 25 contracts previstos existem no layout e estão no mapa (grupo contracts=25).
- Regra em `distribution.mjs`: toda fonte `GLOBAL_KIRO_MANAGED` mapeia para **exatamente um** managed item; `INSTALLABLE_CLASSES = {GLOBAL_KIRO_MANAGED, GENERATED_PACKAGE_CONTENT}` (SOURCE_ONLY/BUILD_TEST_ONLY não podem ter destino global).
- 26º contract global sem managed item → rejeitado (mensagem determinística; coberto por teste).
- Nenhum schema/template novo do control plane nos 64; nenhum contract necessário ausente; zero referência pendente.
- **Determinação: CR-GBL-002 satisfeito — permanece warning aceito (fechado), não revela finding material.**

## Validator, snapshot e planner

- Validador estrutural/semântico integrado a `validate-all` (12º check); reexecutado: `distribution` ok (source 164/locked 164/managed 64/retire 9). Casos negativos (schema, missing/extra/duplicate, path/traversal/case-fold, symlink, tipo, hash, ciclo, adapter) cobertos por `tests/distribution/*` (58/58).
- Snapshot por `lstat`/containment/no-follow; 13 estados canônicos; `IDENTICAL → NO_CHANGE`; unmanaged preservado; legacy modificado/symlink/tipo/parcial-desconhecido bloqueados.
- **Planner read-only:** `createOperationContext` exige `plan.decision === 'CHECKPOINT_REQUIRED'` e bindings 64-hex válidos; operação global sempre `CHECKPOINT_REQUIRED`; segunda execução sintética → 64 `NO_CHANGE`. Sem escrita/temporário/chmod/chown/rename/unlink no planejamento (verificado por código e testes).

## Transação sintética

Exercitada apenas em roots temporárias (código + `installation-apply`/`installation-recovery`/`installation-artifacts`/`bootstrap-flow` tests): staging + rename atômico, revalidação de snapshot/autorização, backup verificável, journal/WAL, receipt fiel, clean install/update, criação de entrypoint, retirada só dos 9 baseline-exact, preservação de extras/diretórios compartilhados, fault injection antes/depois de cada classe de escrita, `KNOWN_RECOVERABLE` vs `UNKNOWN` bloqueado, resume sem repetir writes, rollback por operation ID com before/after hash e restauração de bytes/metadados, remoção só de CREATE com pre-state `ABSENT`. Nenhum acesso a HOME/raiz global.

## Self-update e Etapa B

Uma única ação self-update, última escrita, com todas as anteriores verificadas; write guard fecha após substituição; `RESTART_REQUIRED` em stdout (não escrita de arquivo); receipt pré-restart não declara self-update concluído; Etapa B não inicia automaticamente e tem inputs (operation ID + journal/receipt externos + manifest + estado real) suficientes para reconciliar. Restart/Etapa B reais: **NOT_EXECUTED**.

## Sentinela contra operação global

- Hashes/inventário dos 19 globais capturados ANTES; monitorados; mutações apenas em roots temporárias.
- Guard `assertInjectedInstallationRoots` lança `REAL_GLOBAL_ROOT_PROHIBITED` quando destino/backup é `~/.kiro` (via `resolve(homedir(),'.kiro')`) ou contido nele, e `ROOTS_MUST_BE_EXTERNAL_AND_DISJOINT` para sobreposição; chamado em contexto/apply/rollback. Nenhuma CLI operacional aponta para a raiz global sem gate.
- **Sentinela DEPOIS = ANTES (`f54df075…`): zero alteração global.** Nenhuma escrita real não autorizada — **nenhum finding material**.

## Testes independentes obrigatórios

Diretório `/home/villas/Projects/AgenticDevOps/framework`; efeitos limpos; entrega não mutada.

| Comando | Exit | Resultado |
|---|---:|---|
| `npm run validate` | 0 | **12/12** checks VALID (workflow 14/21; artifacts 20; distribution 164/164/64/9; skills 10; adapters 4; sources 164/164 + deprecation warning) |
| `npm test` | 0 | **135 testes / 135 pass / 0 fail** |
| `node --test tests/distribution/*.test.mjs` | 0 | **58 / 58 / 0** (inclui teste de guarda tmp-root / sem destino global literal) |
| `npm run validate:adapters` | 0 | adapter válido, 4 model mappings |
| `npm run validate:distribution` | 0 | managed 64, retire 9, source/locked 164/164 |

Matriz direcionada relatada (33/33) subsumida pelas suítes reexecutadas (135 + 58). **Digest da árvore antes/depois idêntico (`20e2617c…`)** — validator/testes não mutaram a entrega.

Diagnostics nativos de `tasks.md` reportados pelo executor (formato Kiro nativo): **incompatibilidade cosmética da ferramenta**, não falha de artefato — `get_diagnostics` independente retorna zero e o formato canônico VLS é válido. Não é finding.

## Pacote e reprodutibilidade

Em diretório temporário isolado (`cp -a`; entrega preservada): `npm ci --ignore-scripts --no-audit --no-fund` exit 0 (3 deps pinadas). Duas gerações `npm pack --ignore-scripts` independentes → ambas `434f1c09e6fa68fd1ce8bd2661541c2f2b7fef84e58317753514532e79988505` = **hash relatado**; **136 entradas** (=relatado). Sem paths legacy (`steering/workflow-core`, `steering/contracts/`) no pacote; distribution manifest/schemas/steering/tooling presentes; sem segredos/paths absolutos proibidos. package → lock → manifest → generated reconciliados. **Reprodutibilidade CONFIRMED_DIRECTLY.**

## Segurança (SEC-001–SEC-009)

Containment/realpath (`isWithin`), `lstat`/no-follow (`assertNoSymlinkRegularFile`), rejeição de traversal/absoluto/ancestral symlink, integridade encadeada package→lock→manifest→source, preservação de unmanaged, backup antes de mutação, receipt/journal fiéis (só verificado; sanitizados), allowlist de classes instaláveis, diretórios/metadados seguros sem elevação, negação por padrão e retry controlado — ligados a requisito → implementação → teste negativo → evidência. Sem dependência nova; sem segredo; sem rede. Segurança **não** aprovada genericamente: cada controle exercitado por teste representativo (58 distribuição + 135 amplo).

## Alto risco (proporcional)

Snapshot/backup/journal/receipt/idempotência/falha parcial/rollback/interrupção implementados e testados **somente** em roots sintéticas; nenhuma autorização de implementação tratada como autorização real; self-update/restart/Etapa B separados; sem produção/migração/exclusão real/infra/release/deploy.

## Regressões e preservações

Core tool-neutral (0 nomes de modelo e 0 “Kiro” tool-name em core/policies/contracts/skills; `GLOBAL_KIRO_MANAGED` é rótulo de taxonomia); nomes concretos confinados aos adapters; **nenhuma dependência nova**; Skills e progressive disclosure preservados (SKILL ≤ ~39 linhas); lifecycle v3.0/v3.1/v3.2 de `DiscoveryRouter.md` (warning de depreciação, `removalEligible:false`); comandos oficiais preservados; fontes históricas intactas; adapters ChatGPT/Codex/Claude sem destino global; nenhuma operação real/Git/externa.

## Matriz de rastreabilidade (independente)

| Grupo | Requisitos | Prova independente | Resultado |
|---|---|---|---|
| Inventário 64 / catálogo / metadados | REQ-001–003 | validate:distribution (64/164); 64 destinos únicos; 5 classes | APPROVED |
| Steering determinístico / sem 2ª autoridade | REQ-004–005 | leitura + steering.test | APPROVED |
| Planner read-only / estados / preconditions | REQ-006, 008, 009 | código + snapshot/planner tests; CHECKPOINT_REQUIRED | APPROVED |
| Validator estrutural/semântico | REQ-007 | validate:distribution + validator.test (negativos) | APPROVED |
| Backup/journal/receipt / ordem Etapa A | REQ-010–011 | installation-artifacts/apply tests | APPROVED |
| Retirada dos 9 / self-update / Etapa B | REQ-012–014 | manifest (9 retire, 1 self last) + bootstrap-flow/recovery | APPROVED (real NOT_EXECUTED) |
| Rollback / falha parcial | REQ-015–016 | installation-recovery tests | APPROVED (real NOT_EXECUTED) |
| Gates adapters/piloto | REQ-017 | sem destino não-Kiro; piloto fora das tasks | APPROVED |
| Preservação/regressão | REQ-018 | validate 12/12, test 135, lock 164, pacote reproduzível | APPROVED |
| SEC-001–009 | segurança | código + testes negativos | APPROVED |
| NFR-001–003 | determinismo/idempotência/portabilidade | hash reproduzível; 64 NO_CHANGE; ESM Node 24 | APPROVED |
| COMP-001 / OPS-001–002 | lifecycle/limites | deprecation warning; guarda global; operações reais separadas | APPROVED |

## Findings

Nenhum finding material, de regressão, segurança, escopo, teste, equivalência ou operação global. **Nenhuma `correction-spec.md` criada.**

## Warnings

- **W-001 (CR-GBL-002 — fechado/aceito):** anti-órfão dos 25 contracts implementado e testado; satisfeito. Mantido como warning aceito.
- **W-002:** `DiscoveryRouter.md is deprecated compatibility` — warning esperado do lifecycle; `removalEligible:false`.
- **W-003:** falhas intermediárias relatadas na execução (~11) confirmadas benignas pela reexecução independente limpa (12/12, 135/135, 58/58); sem efeito residual.

## Riscos residuais

- Loader Kiro real, restart e Etapa B comprováveis apenas em fase operacional futura autorizada.
- Atomicidade/ACL reais de Windows só verificáveis em host Windows; nesta rodada apenas semântica injetada.
- Rollback real permanece operação de alto risco separada.

## Validações não executadas (fora do escopo local; não impedem aprovação)

Loader Kiro real; Etapa A real; backup/journal/receipt globais reais; retirada real dos 9 steering; self-update global; restart; Etapa B real; piloto `PROJECT_UPDATE`; atomicidade/ACL Windows reais; rollback real; Git/staging/commit/push/PR/merge (`NOT_APPLICABLE_NO_REPOSITORY`); release/deploy. Motivo: fora do contrato da implementação local e sem autorização.

## Estado final

- Git: N/A (sem `.git`; não inicializado).
- Entrega (`framework/`): inalterada — digest `20e2617c…` antes/depois.
- `~/.kiro/**`: intocado — sentinela `f54df075…` antes/depois.
- Escrita desta validação: somente `evidence/validation/round-01/VALIDATION.md`; temporários de reprodução removidos.
- Zero correção, zero Git, zero operação global.

## Decisão

```
PASSED_WITH_WARNINGS
```

Todos os requisitos aplicáveis (REQ-001–018, SEC-001–009, NFR-001–003, COMP-001, OPS-001–002) comprovados independentemente; nenhum finding exige correção; permanecem apenas warnings não bloqueantes (CR-GBL-002 fechado, depreciação do alias) e itens `NOT_EXECUTED` fora do escopo local por contrato.

## Próxima fase

Retornar à linha de produto e coordenação (ChatGPT) para revisão final e decisão de encerramento técnico. **Não** iniciar `delivery-closeout`, Git, instalação global, restart, Etapa B, piloto, rollback real, release ou deploy.

## Estratégia de sessão

- Revisão final: conversa de produto/coordenação (ChatGPT).
- Preservar sessão executora `engineering-author/framework-v3`.
- Preservar esta sessão `delivery-assurance/framework-v3-global-bootstrap-layout/round-01` para eventual revalidação ou segunda opinião.

## Status

```
PASSED_WITH_WARNINGS
```
