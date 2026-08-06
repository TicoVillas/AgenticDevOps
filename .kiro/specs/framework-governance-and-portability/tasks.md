# Tasks — Framework Governance and Portability

## Identificação

- **Status:** `DRAFT_READY_FOR_CONTRACT_REVIEW`
- **Fase:** `spec/round-01`
- **Papel:** `ENGINEERING`
- **Slug:** `framework-governance-and-portability`
- **Origem:** `requirements.md` e `design.md` drafts
- **Assurance:** `HIGH_RISK`
- **Execução:** milestones ordenados; nenhuma task está autorizada por este draft

## Regras de execução

1. Contract Review independente é obrigatório antes de qualquer execução.
2. Um writer por working tree/root; toda mudança deve ser atribuível.
3. `framework/**` é a fonte de implementação atual até a migração validada para checkout irmão.
4. v2.3, v2.4, análise v3.0 e TGZ atual são read-only até operação de archive autorizada.
5. Local write, archive, remote archive, Git init, commit, GitHub create, push, tag, draft, publish, global install e cleanup são operações separadas.
6. Autopilot só é elegível para lote local determinístico dentro de allowlist e sem checkpoint pendente.
7. `Supervised` é obrigatório para toda operação remota, destrutiva, global, signing, publicação, archive, Git material ou limpeza.
8. Falha de schema/hash/snapshot/authorization/path/signature/lock/atomicity produz stop; `UNKNOWN/PARTIAL` nunca recebe retry cego.
9. Cada milestone fecha testes positivos, negativos, integração e recovery aplicáveis antes do próximo.
10. Dependência nova, runtime distinto, path material novo ou decisão arquitetural divergente produz `REQUIRES_REPLANNING`.

## Mapeamento de milestones: discovery → Spec

O discovery usou `M0–M13` como estrutura conceitual. A Spec refinou essa decomposição para os milestones executáveis `M1–M15`, introduzindo explicitamente contratos/validators e a construção do checkout irmão. A renumeração não altera ordem, gates, decisões nem autorizações. Para execução, os milestones normativos são os definidos neste `tasks.md`; referências históricas ao discovery permanecem rastreáveis pela tabela abaixo.

| Discovery conceitual | Tema no discovery | Milestone(s) executável(is) da Spec | Relação |
|---|---|---|---|
| M0 | Governança fechada | M1, M2 | Formalização em selection record e contratos/validators |
| M1 | Selection record | M1 | Correspondência direta |
| M2 | Proveniência histórica | M3 | Correspondência direta |
| M3 | Release contracts | M4 | Correspondência direta |
| M4 | Lifecycle CLI | M5 | Correspondência direta |
| M5 | `PROJECT_UPDATE` | M6 | Correspondência direta |
| M6 | Installers | M7 | Correspondência direta |
| M7 | CI | M8 | Correspondência direta |
| M8 | Git local | M9, M10 | Checkout irmão é explicitado antes do Git local |
| M9 | GitHub privado | M11 | Correspondência direta |
| M10 | Publicação `3.1.0` | M12 | Correspondência direta |
| M11 | Fresh install Linux | M13 | Correspondência direta |
| M12 | Validação Windows | M14 | Correspondência direta e independente da limpeza |
| M13 | Limpeza local | M15 | Correspondência direta; último milestone |

A tabela é somente de rastreabilidade e não cria dependência adicional entre milestones.

## M1 — Selection record

**Requirements:** SEL-001–012, ACC-001, NFR-001–005, BR-001/005/007  
**Design:** Schemas; Selection guidance flow; Fonte única  
**Dependência:** nenhuma  
**Operação:** local write  
**Modo:** Autopilot após autorização de implementação

- [ ] M1.1 Criar schema/template de execution selection com quatro comparison results.
- [ ] M1.2 Implementar comparação determinística e bloquear somente `NOT_REPORTED`.
- [ ] M1.3 Integrar hash/reference em artifact e transition manifests.
- [ ] M1.4 Atualizar HANDOFF para recommendation, rationale e fallback guidance.
- [ ] M1.5 Atualizar adapters sem mover provider names para core/policies/Skills.
- [ ] M1.6 Criar fixtures `MATCH`, `USER_SELECTED_ALTERNATIVE`, `FALLBACK_USED`, `NOT_REPORTED`.
- [ ] M1.7 Testar independência por role/session e divergência sem warning.

**Validação:** schema positive/negative; boundary scan; handoff snapshots; role/session tests.  
**Stop:** nome concreto fora de adapter/handoff; alternative tratada como finding; effective selection reavaliada.

## M2 — Contratos e validators

**Requirements:** REP-003–008, REL-003–012, INS-004–014, LIF-002–007/014/016–017/020, PRJ-001–003, NFR-001–010, BR-002/004/006–007, ACC-009/016  
**Design:** Schemas novos/alterados; CLI; errors; observability; Fonte única de verdade  
**Dependência:** M1  
**Operação:** local write  
**Modo:** Autopilot após autorização

- [ ] M2.1 Criar release, operation plan/lock/tombstone, archive, platform e evidence schemas.
- [ ] M2.2 Alterar distribution/backup/journal/receipt/transition/artifact schemas com migrations.
- [ ] M2.3 Criar project-update schema family e backup manifest.
- [ ] M2.4 Implementar validators e fixtures por required/enum/binding/additional property.
- [ ] M2.5 Implementar canonical JSON e hashing determinístico.
- [ ] M2.6 Atualizar `framework.lock`, generators e source validators.
- [ ] M2.7 Criar `policies/OperationalRetentionPolicy.md` como fonte normativa única para receipts, journals, tombstones, backup original, três versões e 90 dias, 30 dias pós-uninstall e holds de `UNKNOWN`, `PARTIAL` ou operação não reconciliada; planners e validators devem consumir a policy sem duplicar valores.
- [ ] M2.8 Criar matriz requirement→design→task→test→evidence gerada/validada, exigindo ligações explícitas para `NFR-010`, `BR-002`, `BR-004` e `BR-006`; implementar evidence check que prova que drafts/reviews não concedem autorização e que preflights/planners confrontam artefatos com estado real.

**Testes:** schema, reference resolution, migration v1, generated drift e determinism; fixtures positivas/negativas de todos os boundaries da retention policy; source-of-truth scan que rejeita valores de retenção duplicados em planners/validators; regressão/compatibilidade do schema/migration (`NFR-010`); evidence fixture que rejeita autorização inferida de draft/review (`BR-002`); fixture de artefato divergente do estado real (`BR-004`).  
**Evidência:** policy ownership report; boundary/source-of-truth reports; matriz ACC-016 com links concretos dos quatro IDs transversais; validator reports e fixtures identificadas.  
**Stop:** schema consumidor antes da fonte; breaking change sem version/migration; duplicação normativa; valor de retenção fora da policy; autorização inferida de draft/review.

### Rastreabilidade transversal obrigatória

| ID | Tasks concretas | Testes obrigatórios | Evidência esperada |
|---|---|---|---|
| `NFR-010` | M2.2/M2.8, M5.1 e gates M9.7/M15.2 | regressão de schemas/receipts, lifecycle sem regressão, comparação source→sibling e pré-cleanup | compatibility report ligado à matriz M2.8 |
| `BR-002` | M2.8 e M8.8 | validator/evidence check de não concessão por drafts/reviews; pipeline sem publish implícito | report com draft/review `authorization_granted: false` |
| `BR-004` | M2.8, M5.3, M9.1 e M15.1–M15.2 | preflight/plan com artifact hash válido mas filesystem divergente deve bloquear | snapshot/plan reports com `SNAPSHOT_DIVERGED` |
| `BR-006` | M5.8 e fault injection M5 | crash before/after write produz `PARTIAL/UNKNOWN`; reconcile read-only; retry cego rejeitado | journal, reconciliation decision e negative retry report |

A matriz M2.8 deve falhar se qualquer uma dessas ligações a task, teste ou evidência estiver ausente; classificá-las apenas como “transversais” não satisfaz ACC-016.

## M3 — Archive e proveniência

**Requirements:** ARC-001–010, CLN-005, ACC-003/014/017  
**Design:** Archive; layouts; threat model  
**Dependência:** M2 para schemas; autorização de archive separada  
**Operações:** local archive build → remote write → restore drill; três checkpoints  
**Modo:** Supervised para build com históricos, upload, redownload e restore

- [ ] M3.1 Implementar inventory/provenance generator read-only.
- [ ] M3.2 Gerar Git bundle v2.3 completo e verificar refs/objects.
- [ ] M3.3 Gerar snapshots determinísticos v2.3/v2.4/análise/TGZ com trust labels.
- [ ] M3.4 Validar hashes por arquivo e archive.
- [ ] M3.5 **CHECKPOINT ARCHIVE-LOCAL:** aprovar artifacts locais.
- [ ] M3.6 Criar/popular `TicoVillas/AgenticDevOps-History` somente sob autorização remota.
- [ ] M3.7 Redownload e comparação independente.
- [ ] M3.8 **CHECKPOINT RESTORE:** restaurar em root isolado e provar equivalência.
- [ ] M3.9 Registrar retention indefinida e evidence index.

**Testes:** corrupted archive, missing ref/file, traversal, TGZ trust label, restore hash mismatch.  
**Stop:** histórico alterado; restore incompleto; remote não autorizado.  
**Nota:** M3 não autoriza remoção local.

## M4 — Release contracts

**Requirements:** REL-001–018, REP-005–007, ACC-004/005/018  
**Design:** Release/Ed25519; pipeline; trust boundaries  
**Dependência:** M2; policy privada aprovada para materialização  
**Operação:** local write; signing real excluído desta etapa  
**Modo:** Autopilot local; Supervised para qualquer signing environment

- [ ] M4.1 Implementar release manifest/metadata/SBOM contracts e templates.
- [ ] M4.2 Implementar SHA-256 asset inventory e deterministic serialization.
- [ ] M4.3 Implementar Ed25519 verify/sign interfaces com signer injetado.
- [ ] M4.4 Implementar trust store, key ID/fingerprint, rotation/revocation schemas.
- [ ] M4.5 Documentar incident hard stop e compromised-key handling.
- [ ] M4.6 Criar fake test keys somente em fixtures e secret/private-key scanners.
- [ ] M4.7 Implementar immutable/compensating-control gate.
- [ ] M4.8 Testar tamper, wrong key, revoked key, malformed signature e missing asset.

**Stop:** private key real em repo/log; attestation tornada obrigatória; publish implícito.

## M5 — Lifecycle CLI

**Requirements:** INS-011–014, LIF-001–020, PLT-006/007, NFR-010, BR-004/006–007, ACC-006–009  
**Design:** CLI; planners/state machines; filesystem; lifecycle; errors; `OperationalRetentionPolicy.md`  
**Dependência:** M2/M4  
**Operação:** local write/test em roots temporários; global real proibido  
**Modo:** Autopilot sintético

- [ ] M5.1 Refatorar distribution/installation atuais em módulos CLI com testes explícitos de regressão e compatibilidade (`NFR-010`).
- [ ] M5.2 Implementar command parser, structured output e stable exit codes.
- [ ] M5.3 Implementar snapshot/plan bindings e authorization envelope, sempre confrontando artefatos declarados com o estado real observado (`BR-004`).
- [ ] M5.4 Implementar operation locks, durable journal e atomic writer.
- [ ] M5.5 Completar install/update/reconcile/resume/rollback.
- [ ] M5.6 Implementar uninstall planner/applier/tombstone com ownership guards.
- [ ] M5.7 Implementar retention planner consumindo exclusivamente `policies/OperationalRetentionPolicy.md`, sem repetir valores: indefinite records, original backup, 3 versions+90 days, 30 days post-uninstall e holds de estado incerto.
- [ ] M5.8 Generalizar `UNKNOWN/PARTIAL`, impedir retry/purge e exigir reconcile read-only antes de qualquer continuação (`BR-006`).
- [ ] M5.9 Preservar self-update terminal, hard stop e Stage B real separada.
- [ ] M5.10 Adicionar sanitised event log/evidence index.

**Testes:** state/action matrix; idempotence; lock contention; regressão do comportamento consolidado; artifact-versus-real-state divergence; retention policy consumer/source-of-truth; fault injection before/after intent/write/sync/rename/receipt produzindo `PARTIAL/UNKNOWN`; reconcile read-only; negative blind-retry; recovery; user-modified uninstall preservation.  
**Evidência:** compatibility report M5.1; snapshot divergence report M5.3; retention policy consumption report M5.7; journal/reconcile/retry-negative reports M5.8.  
**Stop:** acesso ao `~/.kiro` real em testes; write sem durable intent; uncertain retry; valor de retenção duplicado fora da policy; artefato aceito sem confronto com estado real.

## M6 — PROJECT_UPDATE

**Requirements:** PRJ-001–011, ACC-010  
**Design:** PROJECT_UPDATE; migrations; state machines  
**Dependência:** M5 engine comum  
**Operação:** local synthetic project roots  
**Modo:** Autopilot para tests; apply real Supervised em milestone futuro

- [ ] M6.1 Implementar project snapshot e separate receipt namespace.
- [ ] M6.2 Implementar proposal-only planner sob `.agentic/**`.
- [ ] M6.3 Implementar checkpoint/authorization binding.
- [ ] M6.4 Implementar user-owned `application-profile.yaml` merge proposal.
- [ ] M6.5 Implementar migration catalog versionado/field-aware/rollback.
- [ ] M6.6 Integrar journal, backup, reconcile e rollback sem compartilhar global receipt.
- [ ] M6.7 Observar Git read-only e listar Git writes como não autorizados.

**Testes:** apply without checkpoint; profile divergence; outside allowlist; symlink; migration forward/back; global receipt unaffected.  
**Stop:** silent profile write; Git write; project/global identity collision.

## M7 — Installers

**Requirements:** INS-001–014, PLT-001–007, ACC-006/011  
**Design:** Download/installer; platform adapters; layouts  
**Dependência:** M4/M5  
**Operação:** local write + synthetic network fixtures  
**Modo:** Autopilot local; real credential/download Supervised

- [ ] M7.1 Implementar platform-neutral downloader interface.
- [ ] M7.2 Implementar `gh` authenticated adapter e error sanitization.
- [ ] M7.3 Implementar API fine-grained read-only adapter e offline bundle adapter.
- [ ] M7.4 Implementar verify-before-extract/staging containment.
- [ ] M7.5 Criar bootstrap Bash 5+ sem planner duplicado.
- [ ] M7.6 Criar bootstrap PowerShell 7.4+ sem planner duplicado.
- [ ] M7.7 Criar contract tests de argumentos, plan e stop conditions equivalentes.
- [ ] M7.8 Registrar Windows como `PROJECTED` até host real.

**Testes negativos:** mutable URL, curl/iex pipeline, traversal, symlink, case collision, token in log, missing Node.  
**Stop:** wrapper escreve global diretamente; auto-instala Node; baixa branch.

## M8 — CI e release pipeline

**Requirements:** CICD-001–015, REL-013–018, ACC-012/013/015  
**Design:** Pipeline; threat model; observability  
**Dependência:** M1–M7  
**Operação:** local workflow files primeiro; GitHub activation separada  
**Modo:** Autopilot para arquivos/testes; Supervised para ativação/secrets/environments

- [ ] M8.1 Criar PR workflow com npm ci ignore-scripts, validate/test e diff-zero.
- [ ] M8.2 Criar lock/package allowlist e governance exclusion tests.
- [ ] M8.3 Criar secret/private-key and mutable-source scans.
- [ ] M8.4 Criar clean dual-build/reproducibility job.
- [ ] M8.5 Criar draft release job com protected environment e least privilege.
- [ ] M8.6 Pin actions por commit e bloquear untrusted PR signing access.
- [ ] M8.7 Criar post-upload/redownload/reverify job.
- [ ] M8.8 Criar immutable gate e explicit compensating-control input.
- [ ] M8.9 Produzir evidence index sanitizado.

**Stop:** secret disponível em PR; action flutuante; workflow publica sem checkpoint.

## M9 — Construção do novo checkout

**Requirements:** REP-001–009, CLN-001–003, NFR-010, BR-004, ACC-002/017/018  
**Design:** Layout; checkout irmão; package policy  
**Dependência:** M1–M8 e archive restaurável M3  
**Operação:** local write em diretório irmão  
**Modo:** Supervised no primeiro materialization; Autopilot em copy/verify aprovado

- [ ] M9.1 Preflight de source/destination/writer e manifest de migração, confrontando manifest/hashes com o estado real imediatamente antes da cópia (`BR-004`).
- [ ] M9.2 Criar diretório irmão exclusive.
- [ ] M9.3 Copiar `framework/` para raiz por allowlist/hash; nunca mover.
- [ ] M9.4 Incluir `AGENTS.md`, `.agentic/**`, `.kiro/specs/**` como governance-only.
- [ ] M9.5 Adicionar private-use policy e remover `UNLICENSED` do novo checkout.
- [ ] M9.6 Excluir TGZ/history/node_modules/operational state/private keys.
- [ ] M9.7 Executar validate/test/pack, suíte de regressão/compatibilidade (`NFR-010`) e comparar source→destination.
- [ ] M9.8 **CHECKPOINT NEW-CHECKOUT:** aprovar árvore antes de Git.

**Rollback:** excluir somente sibling owned após evidence; workspace anterior intacto.  
**Stop:** destination preexists/diverges; source changed; package includes governance.

## M10 — Git local

**Requirements:** CICD-007/012/013, CLN-001–003, BR-003  
**Dependência:** M9 aprovado  
**Operação:** Git local  
**Modo:** Supervised

- [ ] M10.1 Preflight root, writer, files, secrets, hooks e identity readiness.
- [ ] M10.2 **CHECKPOINT GIT-INIT:** autorizar init.
- [ ] M10.3 Inicializar repository no sibling e verificar status.
- [ ] M10.4 Stage selective allowlist.
- [ ] M10.5 **CHECKPOINT COMMIT:** autorizar commit inicial.
- [ ] M10.6 Criar commit com evidence/hash; não configurar remote.

**Stop:** secret/key/history unexpected; hook failure; path outside sibling.

## M11 — GitHub

**Requirements:** REP-001, ARC-001, CICD-007–014  
**Dependência:** M10; M3 para history repo  
**Operação:** remote writes/configuration  
**Modo:** Supervised

- [ ] M11.1 Confirmar auth/owner/visibility e planos sem expor token.
- [ ] M11.2 **CHECKPOINT REPO-CREATE:** criar `TicoVillas/AgenticDevOps` privado.
- [ ] M11.3 Configurar remote e **CHECKPOINT PUSH** separado.
- [ ] M11.4 Configurar branch protection/rulesets/status checks.
- [ ] M11.5 Configurar protected release/signing environment sem private key no repo.
- [ ] M11.6 Verificar immutable release capability; registrar gate.
- [ ] M11.7 Configurar history repository apenas se não concluído em M3.

**Stop:** wrong owner/visibility; plan unsupported without compensating decision; permissions excessive.

## M12 — Release `3.1.0`

**Requirements:** REL-001–018, CICD-006–015, ACC-004/005/013  
**Dependência:** M11 + all CI green  
**Operações:** tag, signing, draft, publish distintas  
**Modo:** Supervised

- [ ] M12.1 Validar version/tag/commit e clean rebuild.
- [ ] M12.2 **CHECKPOINT TAG:** criar tag `v3.1.0`.
- [ ] M12.3 Build dual, SBOM, manifest/checksums e Ed25519 signing.
- [ ] M12.4 **CHECKPOINT DRAFT:** criar/upload draft.
- [ ] M12.5 Redownload/reverify draft e independent evidence review.
- [ ] M12.6 **CHECKPOINT PUBLISH:** publicar somente com immutability ou controle aprovado.
- [ ] M12.7 Redownload/reverify release publicada e fechar evidence index.

**Stop:** key incident; hash/reproducibility drift; immutable gate missing; failed independent checkpoint.

## M13 — Fresh-install Linux

**Requirements:** PLT-001/006/007, INS-*, LIF-*, CLN-005, ACC-006–009/011/014  
**Dependência:** M12 release verificável  
**Operação:** global/high-risk host operation  
**Modo:** Supervised

- [ ] M13.1 Provisionar host Linux x86-64/Bash 5+/Node 24/npm compatible.
- [ ] M13.2 Preflight clean state, roots, permissions, writer e rollback.
- [ ] M13.3 Download via authenticated `gh`, verify and plan.
- [ ] M13.4 **CHECKPOINT GLOBAL-INSTALL:** autorizar apply.
- [ ] M13.5 Executar install, self-update hard stop e restart real.
- [ ] M13.6 Executar Stage B read-only e final receipt.
- [ ] M13.7 Testar NO_CHANGE, update/reconcile/rollback/uninstall conforme ambiente aprovado.
- [ ] M13.8 Registrar `VALIDATED_ON_HOST` e limitações.

**Stop:** any divergence/unknown; rollback unavailable; receipt incomplete.

## M14 — Validação Windows

**Requirements:** PLT-002–007, ACC-011  
**Dependência:** M7 e M12; independente de limpeza Linux  
**Operação:** host Windows real/global  
**Modo:** Supervised

- [ ] M14.1 Provisionar Windows 11/PowerShell 7.4+/Node 24.
- [ ] M14.2 Executar preflight, download, verify e plan.
- [ ] M14.3 **CHECKPOINT WINDOWS-INSTALL:** autorizar apply.
- [ ] M14.4 Validar ACL, atomicity, case-folding, lock, restart e receipts.
- [ ] M14.5 Exercitar recovery/uninstall e comparar semântica Linux.
- [ ] M14.6 Só então promover capability para `VALIDATED_ON_HOST`.

**Stop:** platform semantic/security divergence; unsupported atomicity.  
**Regra:** M14 não bloqueia release Linux se Windows estiver explicitamente `PROJECTED`, mas nenhum claim Windows é permitido.

## M15 — Limpeza final

**Requirements:** CLN-004–006, ARC-008–010, REP-009, NFR-010, BR-004, ACC-014/017  
**Dependência obrigatória:** M3 restore PASS + M12 release verified + M13 Linux PASS + workspace preservation PASS  
**Operação:** destructive local  
**Modo:** Supervised

- [ ] M15.1 Construir fresh inventory/snapshot do workspace anterior e confrontá-lo com manifests/artefatos canônicos (`BR-004`).
- [ ] M15.2 Verificar quatro gate evidence hashes, regressão/compatibilidade final (`NFR-010`) e ausência de unresolved/UNKNOWN/PARTIAL.
- [ ] M15.3 Gerar cleanup plan path-by-path com classificação e rollback/restore source.
- [ ] M15.4 Executar dry-run e revisão independente.
- [ ] M15.5 **CHECKPOINT CLEANUP:** autorização explícita para paths nomeados.
- [ ] M15.6 Remover somente paths autorizados que ainda coincidem com snapshot.
- [ ] M15.7 Verificar preservação, archive restore pointers e tombstone/evidence.

**Stop:** qualquer gate ausente, path divergente, writer ativo, backup/archive inválido ou autorização não específica.

## Matriz compacta de dependências e modos

| M | Resultado | Depende | Autopilot | Supervised obrigatório |
|---|---|---|---|---|
| 1 | selection record | — | local deterministic | não, salvo decisão |
| 2 | contracts/validators | 1 | sim | não |
| 3 | archive proveniente | 2 | somente geração aprovada | archive/upload/restore |
| 4 | release contracts | 2 | código/testes | signing real |
| 5 | lifecycle CLI | 2,4 | synthetic roots | global real |
| 6 | PROJECT_UPDATE | 5 | synthetic | apply real |
| 7 | installers | 4,5 | synthetic | credential/real download |
| 8 | CI/release workflows | 1–7 | files/tests | activation/secrets |
| 9 | sibling checkout | 1–8,3 | copy/verify após checkpoint | materialization inicial |
| 10 | Git local | 9 | não | todo write Git |
| 11 | GitHub | 10 | não | todo remote/config |
| 12 | release | 11 | não | tag/sign/draft/publish |
| 13 | Linux host | 12 | não | global operations |
| 14 | Windows host | 7,12 | não | global operations |
| 15 | cleanup | 3,12,13 | não | destructive cleanup |

## Cobertura de testes e evidência

Cada milestone deve produzir: validator report, unit/negative/integration/recovery results aplicáveis, source/destination hashes, action/operation IDs, limitations, `operations_not_authorized` e evidence index. M3, M9–M15 exigem estado antes/depois e checkpoint ref. M5–M7 exigem fault injection. M12–M14 exigem redownload/host evidence. M15 exige restore pointers.

## Operações não autorizadas por este draft

Todas as tasks acima são planejamento. Este documento não autoriza implementação, archive, exclusão, Git, GitHub, signing, tag, release, instalação global, `PROJECT_UPDATE`, rollback, uninstall, fresh-install ou limpeza.
