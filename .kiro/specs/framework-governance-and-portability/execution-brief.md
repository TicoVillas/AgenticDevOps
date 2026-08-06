# Execution Brief — Framework Governance and Portability

## Identificação

- **Status:** `DRAFT_READY_FOR_CONTRACT_REVIEW`
- **Fase:** `spec/round-01`
- **Papel autor:** `ENGINEERING`
- **Slug:** `framework-governance-and-portability`
- **Origem:** discovery `APPROVED_FOR_SPEC`; requirements/design/tasks drafts
- **Assurance:** `HIGH_RISK`
- **Estratégia de execução proposta:** milestones progressivos, writer único e autorização por operação

## Natureza deste brief

Este documento resume um contrato executável futuro. **Drafts não autorizam implementação.** Contract Review independente é obrigatório antes de qualquer execução. Aprovação do Contract Review também não autoriza automaticamente implementação, archive, Git, GitHub, signing, release, instalação global, `PROJECT_UPDATE`, rollback, uninstall, fresh install, exclusão ou limpeza.

## Objetivo executável futuro

Evoluir o framework atual para `3.1.0` com:

- selection guidance registrada sem retirar decisão do usuário;
- repositório privado canônico `TicoVillas/AgenticDevOps`, com conteúdo de `framework/` na raiz;
- governance paths versionados e excluídos de runtime assets;
- archive restaurável em `TicoVillas/AgenticDevOps-History`;
- release imutável, hash-bound e assinada com Ed25519;
- installer sem clone e CLI Node canônica;
- lifecycle global completo e fail-closed;
- `PROJECT_UPDATE` separado;
- Linux validado primeiro e Windows somente após host real;
- limpeza local por último e após quatro gates comprovados.

## Seleção registrada para autoria da Spec

```yaml
effective_selection:
  family: Codex
  model: GPT-5.6 Sol
  effort: HIGH
  agent_workflow: Kiro Default
  mode: AUTOPILOT
  suggested_alternative_used: false
comparison_result: MATCH
```

A seleção não concede autoridade operacional.

## Artefatos do contrato

- `discovery.md` — `APPROVED_FOR_SPEC`
- `requirements.md` — `DRAFT_READY_FOR_CONTRACT_REVIEW`
- `design.md` — `DRAFT_READY_FOR_CONTRACT_REVIEW`
- `tasks.md` — `DRAFT_READY_FOR_CONTRACT_REVIEW`
- `execution-brief.md` — `DRAFT_READY_FOR_CONTRACT_REVIEW`

## Dependências e ordem vinculante

```text
M1 selection record
→ M2 contracts/validators
→ M3 archive/provenance
→ M4 release contracts
→ M5 lifecycle CLI
→ M6 PROJECT_UPDATE
→ M7 installers
→ M8 CI/release pipeline
→ M9 sibling checkout
→ M10 Git local
→ M11 GitHub
→ M12 release 3.1.0
  ├→ M13 fresh-install Linux → M15 cleanup final
  └→ M14 Windows real-host validation
```

A representação acima é de ordem/gates, não cria dependências novas. `M14` depende de `M7` e `M12`, conforme `tasks.md`, e é independente de `M15`. Windows permanece `PROJECTED` enquanto não houver validação em host real. A ausência de validação Windows não bloqueia M15, cuja dependência continua limitada a M3 restore PASS, M12 release verified, M13 Linux PASS e workspace preservation PASS. Essa independência não autoriza qualquer claim de suporte Windows.

Dependências exatas, critérios de interrupção e modos constam em `tasks.md`. Milestones não podem ser colapsados para herdar autoridade.

## Estratégia de writer único

- um writer por working tree, destination root e operation class;
- estado inicial, owner, root, allowlist e autorização são registrados antes da escrita;
- checkout irmão e workspace original usam writers e locks distintos;
- signing environment, history repository, canonical repository e global destination são resources distintos;
- falha/estado incerto libera o writer somente após reconcile explícito; stale lock não é removido automaticamente.

## Áreas autorizáveis após review e autorização futura

### Implementação local, milestones M1–M8

- `framework/contracts/**`
- `framework/policies/**`
- `framework/adapters/**`
- `framework/tools/**`
- `framework/installers/**` ou `framework/installers` a promover
- `framework/release/**`
- `framework/tests/**`
- `framework/package.json`, `package-lock.json`, `framework.lock`
- generated outputs estritamente derivados

A allowlist física final deve ser reconfirmada no preflight da execução. Dependência nova ou path material adicional exige replanejamento/review.

### Operações condicionais independentes

- M3: artifacts de archive e remote history repository;
- M9: novo diretório irmão;
- M10: `.git` somente no novo checkout;
- M11: remote/rulesets/environments;
- M12: tag/signing/draft/publish;
- M13/M14: state/global roots dos hosts aprovados;
- M15: somente paths nomeados no cleanup plan.

Nenhuma dessas áreas está autorizada por este draft.

## Áreas preservadas

- `Kiro_v2_3_source/**`, `Kiro_v2_4_source/**`, `Analise_Workflow_v3.0.md` até archive e cleanup autorizados;
- workspace anterior inteiro até M15;
- instalação global até M13/M14;
- user-modified/unmanaged content durante uninstall;
- `application-profile.yaml` sem merge proposal e checkpoint;
- chave privada fora de repo/package/assets/logs.

## Checkpoints independentes

1. `IMPLEMENTATION_START` — após Contract Review aprovado e autorização local.
2. `ARCHIVE_LOCAL` — artifacts locais de archive.
3. `ARCHIVE_REMOTE` — criação/upload no history repo.
4. `ARCHIVE_RESTORE` — restore drill.
5. `NEW_CHECKOUT` — materialização/validação do sibling.
6. `GIT_INIT`.
7. `COMMIT`.
8. `REPO_CREATE`.
9. `PUSH`.
10. `TAG_V3.1.0`.
11. `SIGN` — uso da chave protegida.
12. `DRAFT_RELEASE`.
13. `PUBLISH_RELEASE` — após immutability gate.
14. `GLOBAL_INSTALL_LINUX`.
15. `PROJECT_UPDATE_APPLY`, se pilot autorizado.
16. `GLOBAL_INSTALL_WINDOWS`.
17. `ROLLBACK_REAL` ou `UNINSTALL_REAL` por operação.
18. `CLEANUP_FINAL` path-by-path.

Uma aprovação não cobre outro checkpoint.

## Modo operacional

- **Autopilot elegível:** alterações locais determinísticas M1–M2, M4–M8 e testes em roots temporários, quando a autorização de implementação delimitar paths e não houver checkpoint pendente.
- **Supervised obrigatório:** archive com históricos, remote writes, sibling materialization inicial, Git, GitHub, secrets/signing, tag/release, global operations, real `PROJECT_UPDATE`, rollback/uninstall real e limpeza.
- O modo nunca amplia autorização.

## Testes obrigatórios

### Estruturais e unitários

- schemas/fixtures por campo, enum, binding e migration;
- selection comparison e provider boundary;
- canonical JSON, SHA-256 e Ed25519 positive/tamper/wrong/revoked key;
- path containment, symlink, type, case-fold e traversal;
- lock/state/retention/state-machine tables;
- secret/private-key redaction.

### Integração e recuperação

- install/update/reconcile/resume/rollback/uninstall em roots temporários injetados;
- `PROJECT_UPDATE` proposal/checkpoint/profile protection;
- fault injection before/after intent, write, sync, rename, receipt e self-update;
- `UNKNOWN/PARTIAL` sem retry/purge;
- bash/PowerShell contract equivalence;
- archive bundle/snapshot verify e restore drill;
- CI package allowlist, generated diff zero, dual build e redownload.

### Host real

- Linux x86-64, Bash 5+, Node 24 e npm lock-compatible antes de cleanup;
- Windows 11/PowerShell 7.4+ em milestone independente antes de claim validated.

Comandos-base atuais permanecem `npm run validate` e `npm test`; novos comandos só após implementação/review. Testes não acessam o global root real salvo operação de host explicitamente autorizada.

## Evidências obrigatórias

- preflight, authorization ref, root/writer e snapshot hashes;
- validator/test reports e exit codes;
- matriz requirement→design→task→test→evidence;
- source/package/release/archive hashes;
- signing key ID/fingerprint, nunca private material;
- journals, receipts, tombstones e evidence indexes sanitizados;
- before/after state para operações materiais;
- redownload/reverify results;
- capability level `PROJECTED`, `SYNTHETICALLY_VALIDATED` ou `VALIDATED_ON_HOST`;
- `operations_not_authorized` em cada milestone.

## Riscos materiais

- supply-chain substitution de tag/asset;
- comprometimento ou exposição de signing key/token;
- TOCTOU, symlink/path traversal e writer concorrente;
- retry após efeito incerto;
- uninstall/cleanup removendo conteúdo do usuário;
- PROJECT_UPDATE sobrescrevendo profile;
- divergência Linux/Windows;
- archive incompleto ou irrestaurável;
- generated output virar segunda fonte;
- publicação sem imutabilidade/controle aprovado;
- claim de plataforma sem host evidence.

Mitigações estão normatizadas em requirements/design e devem ser provadas por negative tests.

## Stop conditions

Interromper e retornar ao contrato/usuário quando ocorrer:

- requirement sem design/task/test/evidence;
- hash, signature, snapshot, plan ou authorization divergence;
- provider name fora de adapter/handoff;
- dependency/runtime/path material não aprovado;
- segredo/private key em repo, artifact, stdout ou evidence;
- unsupported atomicity/permission semantics;
- lock ativo/stale não reconciliado;
- estado `UNKNOWN`, `PARTIAL` ou efeito não observado;
- backup ausente/inválido;
- self-update seguido de qualquer write;
- immutable release indisponível sem controle compensatório aprovado;
- archive restore ou dual build divergente;
- Windows sem host real sendo marcado validated;
- cleanup sem qualquer um dos quatro gates ou com path divergente;
- tentativa de inferir autorização entre milestones.

## Rollback e recovery

- implementação local: reverter somente delta atribuível após preservar evidence;
- sibling checkout: descartar apenas root owned; workspace anterior permanece;
- archive: não remover origem; corrigir/publicar novo artifact;
- release publicada: não mover tag; publicar versão corretiva;
- global/project: usar planner/receipt/backups e autorização específica;
- uncertain state: reconcile read-only antes de resume/rollback;
- cleanup: restore apenas de archive/backup verificado e path autorizado.

## Gates prévios à limpeza

M15 fica bloqueado até haver evidência hash-bound de:

1. archive histórico restaurável;
2. release `v3.1.0` verificável;
3. fresh install Linux comprovado;
4. preservação integral do workspace anterior.

Windows validation é milestone independente e não é substituída por Linux; ausência de Windows real mantém status `PROJECTED`.

## Operações explicitamente não autorizadas

Este draft não autoriza:

- implementação em `framework/**`;
- criação/mutação de archive;
- novo checkout;
- exclusão/reorganização;
- Git init/stage/commit;
- GitHub create/configure/push;
- tag/release/signing;
- alteração de instalação global;
- install/update/reconcile/resume/rollback/uninstall real;
- `PROJECT_UPDATE` real;
- fresh-install validation;
- limpeza.

## Contract Review obrigatório

A próxima fase, somente após roteamento explícito do usuário, é uma nova sessão independente `contract-review`, papel `CONTRACT_ASSURANCE`, com `HighRiskOverlay`. O reviewer deve confrontar discovery, requirements, design, tasks, execution brief e estado real; verificar completude, executabilidade, segurança, rastreabilidade e separação de autorizações. Esta sessão autora não inicia o review.

## Retorno esperado

O contrato permanece draft até decisão de Contract Assurance. A saída esperada desta sessão é `DRAFT_READY_FOR_CONTRACT_REVIEW`, sem implementação e sem autoridade operacional implícita.
