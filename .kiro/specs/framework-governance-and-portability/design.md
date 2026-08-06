# Design — Framework Governance and Portability

## Identificação

- **Status:** `DRAFT_READY_FOR_CONTRACT_REVIEW`
- **Fase:** `spec/round-01`
- **Papel:** `ENGINEERING`
- **Slug:** `framework-governance-and-portability`
- **Origem:** `discovery.md` `APPROVED_FOR_SPEC`; `requirements.md` draft
- **Assurance:** `HIGH_RISK`
- **Estratégia:** requirements-first, evolução incremental do framework atual

## Estratégia

Evoluir o código atual sem criar um segundo engine: preservar `tools/lib/distribution.mjs` e `tools/lib/installation.mjs` como base, extrair contratos reutilizáveis, adicionar uma CLI Node canônica e wrappers finos de plataforma. A migração para `TicoVillas/AgenticDevOps` ocorre em checkout irmão. Regras normativas ficam em schemas/policies; planners as executam; installers não as duplicam.

## Componentes e limites de confiança

```text
ChatGPT Project guidance ─┐
User selection ───────────┼→ selection record → artifacts/handoff
Kiro runtime metadata ────┘

GitHub private release (UNTRUSTED UNTIL VERIFIED)
  → downloader adapter (gh | API | offline)
  → signature/checksum verifier
  → contained staging
  → canonical Node CLI
      → snapshot readers (read-only)
      → planners (pure/fail-closed)
      → authorization binder
      → operation lock
      → journal/backup writer
      → atomic applier
      → reconciler/rollback/uninstall
  → global destination ~/.kiro (separate trust root)
  → external state root (receipts/backups/locks)

Project root (separate trust root)
  → PROJECT_UPDATE snapshot/planner/journal/receipt
  → optional Git observation; Git writes remain external checkpoints
```

| Boundary | Entrada não confiável | Controle |
|---|---|---|
| Guidance → record | texto/provider names | schema + enum + comparison deterministic |
| GitHub → staging | assets/metadata/network | exact release, Ed25519, SHA-256, size, contained paths |
| Staging → CLI | archive/files | regular-file only, no symlink/device/traversal |
| CLI → global root | filesystem concorrente | realpath, lock, snapshot binding, authorization, atomic writes |
| CLI → project root | user-owned config/Git | separate planner/receipt, allowlist, checkpoint, merge proposal |
| Build → signing | workflow/PR content | protected environment, no untrusted context, least privilege |
| Archive → cleanup | remote persistence claim | redownload, restore drill, hash-by-file comparison |

## Fonte única de verdade

| Regra | Fonte canônica | Consumidores |
|---|---|---|
| Selection shape/comparison | `contracts/schemas/execution-selection.schema.yaml` | preflight, artifacts, handoff validator |
| Provider/model catalog | `adapters/<provider>/` | selection validator/handoffs |
| Distribution payload/destinations | `adapters/kiro/distribution-manifest.yaml` | snapshot/planner/packaging |
| Operation lifecycle | schemas + `tools/lib/lifecycle/` | CLI and installers |
| Release shape | release schemas | build/publish/install verify |
| Retention | `policies/OperationalRetentionPolicy.md` | prune planner only |
| Project migration | project-update schemas + migrations catalog | project planner/applier |
| Platform behavior | platform adapter contract | bash/PowerShell wrappers |

Skills reference these sources; they do not copy field lists or state machines. Installers only parse bootstrap arguments, obtain verified payload and invoke the CLI.

## Layout do repositório canônico

```text
TicoVillas/AgenticDevOps/
├── AGENTS.md                         # governance, excluded from package
├── .agentic/**                       # governance, excluded from package
├── .kiro/specs/**                    # governance, excluded from package
├── adapters/
├── contracts/
│   ├── schemas/
│   └── templates/
├── core/
├── decisions/
├── generated/
├── policies/
├── skills/
├── tools/
│   ├── cli.mjs
│   └── lib/
│       ├── lifecycle/
│       ├── release/
│       ├── archive/
│       ├── project-update/
│       └── platform/
├── installers/{install.sh,install.ps1}
├── release/{schemas,templates,public-keys}/
├── tests/
├── .github/workflows/
├── framework.lock
├── package.json
├── package-lock.json
└── PRIVATE-USE-LICENSE.md
```

`package.json.files` continua allowlist. Um validator independente calcula o payload e falha se `AGENTS.md`, `.agentic/`, `.kiro/specs/`, tests, workflows, histories, key material privado ou operational state aparecerem.

## Schemas novos e alterados

### Novos

| Schema | Responsabilidade |
|---|---|
| `execution-selection.schema.yaml` | guidance, effective selection e comparison result |
| `release-manifest.schema.yaml` | identidade/bindings/assets/platform validation/signing metadata |
| `release-metadata.schema.yaml` | build/workflow/reproducibility/attestation status |
| `operation-plan.schema.yaml` | plan comum, snapshot, authorization binding, actions/stops |
| `operation-lock.schema.yaml` | root, holder, process/session, lease metadata sem segredo |
| `operation-tombstone.schema.yaml` | uninstall/destructive history e retention |
| `uninstall-manifest.schema.yaml` | escopo e ownership de paths gerenciados |
| `project-update-{manifest,plan,journal,receipt}.schema.yaml` | lifecycle de projeto separado |
| `project-update-backup-manifest.schema.yaml` | backups do projeto |
| `archive-provenance-manifest.schema.yaml` | source sets, file hashes, archives, Git bundle e trust label |
| `platform-capability.schema.yaml` | PROJECTED/SYNTHETICALLY_VALIDATED/VALIDATED_ON_HOST |
| `evidence-index.schema.yaml` | resultados sanitizados de build/release/host |

### Alterados

- `distribution-manifest.schema.yaml`: version/release binding, destination classes e payload policy sem duplicar release manifest.
- `distribution-backup-manifest.schema.yaml`: retention class, origin operation e legal hold para estados incertos.
- `installation-journal.schema.yaml`: plan hash, durable intent sequence, `PARTIAL`, reconciliation metadata e fsync evidence.
- `installation-receipt.schema.yaml`: release/plan/journal bindings, platform status, finalization stage e predecessor receipt.
- `transition-manifest.schema.yaml`: referência/hash do selection record, não provider rules.
- `artifact.schema.yaml`: optional selection reference comum.

Schemas usam IDs URN versionados e `additionalProperties: false` onde seguro. Mudança incompatível exige nova versão, migration e fixture.

## Selection guidance flow

```text
ChatGPT recommendation + fallback guidance
  → user chooses in Kiro
  → executor records effective_selection before preflight
  → deterministic compare
     MATCH | USER_SELECTED_ALTERNATIVE | FALLBACK_USED | NOT_REPORTED
  → only NOT_REPORTED blocks completion
  → artifact/transition/handoff carry selection record hash
```

Provider names são permitidos apenas em adapter-owned fields e handoffs. O schema estrutural pode aceitar strings, mas `validate-selection-boundaries` aplica path ownership. `USER_SELECTED_ALTERNATIVE` e `FALLBACK_USED` são estados válidos sem finding. Session/role validators, e não o modelo, aplicam independência de assurance.

## Arquitetura da CLI

CLI proposta: `node tools/cli.mjs <command>`.

| Command | Mutação | Saída |
|---|---|---|
| `release verify` | nenhuma | verificação de assinatura/assets |
| `global inspect` | nenhuma | snapshot |
| `global plan install|update|rollback|uninstall` | state plan somente | plan + checkpoint |
| `global apply --plan --authorization` | global/state | journal/receipt |
| `global reconcile` | nenhuma | decision/reconciled journal proposal |
| `global resume` | global/state | continued journal |
| `global verify` | nenhuma | Stage B/final receipt proposal |
| `project inspect|plan|apply|reconcile|rollback` | conforme command | project artifacts separados |
| `archive build|verify|restore-plan` | local/ephemeral; remote separado | provenance/evidence |

Parsing, validation and planning precedem qualquer write. Exit codes são estáveis e stdout estruturado; mensagens humanas vão a stderr sem segredo. Bootstraps chamam CLI com argument array, nunca shell interpolation.

## Layouts de state, staging, backup e archive

### Linux

```text
${XDG_STATE_HOME:-$HOME/.local/state}/agentic-devops/
├── locks/<destination-id>.lock
├── operations/<operation-id>/{plan,journal,receipt,evidence}.yaml
├── backups/<operation-id>/{backup-manifest.yaml,files/}
├── tombstones/<operation-id>.yaml
└── keys/trust-store.yaml             # public trust only

${TMPDIR}/agentic-devops-<random>/     # mode 0700 staging
```

### Windows

Equivalente sob `%LOCALAPPDATA%\AgenticDevOps\State\`; staging usa diretório temporário ACL-restrito. Paths lógicos permanecem `/`; platform adapter converte apenas na boundary de filesystem.

### Archive

Archives são gerados em staging owned e publicados em operação remota separada. O history repository armazena manifests, Git bundles e snapshots; restore ocorre em root novo, nunca sobre o workspace.

## Snapshot, planners e state machines

Snapshot é observação imutável ordenada e hashada: path lógico, presence, type, hash, size, metadata aplicável e receipt ownership. Planner é função pura `manifest + snapshot + prior receipt + policy → plan`.

### Operation state

```text
PLANNED
  → AUTHORIZED
  → BACKED_UP
  → APPLYING
  → APPLIED
  → VERIFIED
  → RESTART_REQUIRED
  → POST_RESTART_VERIFIED
  → COMPLETED
```

Falhas observáveis vão a `FAILED_KNOWN`; interrupção entre intent e observação vai a `PARTIAL`; impossibilidade de determinar efeito vai a `UNKNOWN`. `PARTIAL/UNKNOWN` não transicionam diretamente para retry: somente `reconcile` pode propor `READY_TO_RESUME`, rollback plan ou `BLOCKED`.

### Action state

`PLANNED → INTENT_DURABLE → APPLYING → APPLIED → VERIFIED`. Intent deve ser fsync/sync equivalente antes do efeito. Cada action contém before hash, expected after hash, backup ref e stop conditions.

### Idempotência

- applied hash esperado → `NO_CHANGE`;
- pre-state exato → ação ainda aplicável;
- qualquer terceiro estado → `BLOCKED`;
- receipt final repetido → retorna receipt/NO_CHANGE;
- state incerto → nunca auto-retry.

## Atomicidade, locks e filesystem

- normalize e reject antes de resolve; rejeitar absoluto, `..`, NUL, backslash em path lógico e case-fold collision;
- caminhar ancestry com `lstat`; nenhum symlink é seguido;
- writes: temp sibling exclusivo, mode restrito, write, sync file, rename/replace, sync parent quando suportado, reread/hash;
- backup usa create-exclusive e verificação byte/hash antes de apply;
- lock exclusivo por destination root; metadata inclui operation ID e timestamps; stale lock exige checkpoint/reconcile, nunca delete automático;
- Linux preserva mode/uid/gid quando autorizado; Windows registra ACL/owner aplicável sem fingir equivalência POSIX;
- falha de atomic primitive ou permission model vira `NEEDS_STATE_VALIDATION` ou `BLOCKED`.

## Release contracts e Ed25519

`release-manifest` é canonical JSON serializado deterministically (UTF-8, key order definido, LF, sem whitespace ambíguo). A assinatura cobre os bytes exatos do manifest; `SHA256SUMS.sig` cobre os bytes exatos do checksum file.

Trust store versiona:

```yaml
keys:
  - key_id: release-2026-01
    algorithm: Ed25519
    fingerprint_sha256: <hex>
    public_key: <encoded>
    valid_from: <timestamp>
    status: ACTIVE | RETIRED | REVOKED
    supersedes: <optional>
```

Chave privada entra somente no protected signing environment. PR/fork jobs não têm acesso. Manifest registra key ID/fingerprint. Rotação usa overlap controlado; revogação autenticada é verificada antes de confiar em release nova. Comprometimento bloqueia publish e dispara incident procedure.

Assets da `v3.1.0`: package, manifest+sig, `framework.lock`, package lock, checksums+sig, release metadata, installers, public key metadata, SBOM, schemas offline e attestation opcional.

## Download e installer

1. wrapper valida runtime e argumentos;
2. obtém metadata da tag `v3.1.0` via `gh`; API read-only/offline são adapters alternativos;
3. cria staging restrito;
4. baixa manifest, signatures, checksums e trust metadata;
5. verifica Ed25519 e identity bindings;
6. baixa assets por nome/tamanho esperado;
7. verifica SHA-256 antes de extrair;
8. extrai regular files sob root contido;
9. executa CLI `release verify` novamente;
10. executa `inspect/plan` e retorna checkpoint;
11. apply ocorre somente em nova invocação/autorização.

`install.sh` requer Bash 5+; `install.ps1` requer PowerShell 7.4+. Nenhum wrapper implementa planner ou escreve diretamente no global root.

## Lifecycle global

- **Install:** absence→create; conflitos bloqueiam; backup de substituição/retirement é verificado e original permanece enquanto instalado.
- **Update:** somente known managed hash; receipt predecessor obrigatório; retenção 3 versões e ≥90 dias.
- **Reconcile/resume:** observação read-only, bindings e journal; sem mutação durante reconcile.
- **Rollback:** reverse order, after-hash guard, restore backup verificado; autorização própria.
- **Uninstall:** remove created somente se unchanged; restaura managed predecessor; preserva user-modified/unmanaged; tombstone indefinido e backup 30 dias.
- **Self-update:** item único, topologicamente final; hard stop e restart real.
- **Stage B:** nova execução read-only valida 64 managed paths, Skills, legacy absences, loader e NO_CHANGE antes do final receipt.

Retention planner nunca remove backup ligado a `UNKNOWN`, `PARTIAL`, unreconciled ou hold manual.

## PROJECT_UPDATE

Usa engine comum de paths/journal, mas namespace, schemas, root, receipts e authorizations separados. Planner lê `.agentic`, profile e Git state; gera proposta. `application-profile.yaml` é `USER_OWNED`: create se ausente e autorizado; se presente, somente field-aware merge proposal. Apply requer checkpoint e snapshot current. Git writes não são ações do project plan; podem aparecer somente em `operations_not_authorized` e handoff separado.

Migration catalog:

```yaml
id: project-profile-v1-to-v2
from_version: 1
to_version: 2
owned_fields: []
preconditions: []
transform: <implementation ref>
rollback: <implementation ref>
fixtures: []
```

## Archive e migração para checkout irmão

Um migration manifest classifica cada source path como governance, runtime source, generated, package-only, history ou excluded. Copier verifica source hash, cria destination exclusive e rereads. Nunca move. Novo checkout é validado antes de Git.

Archive flow: inventory→manifest→Git bundle/snapshots→local verify→checkpoint remote write→upload→redownload→restore isolated→evidence. Limpeza só recebe plan quando todos os gates possuem evidence hashes.

## Pipeline CI/release

### PR

`npm ci --ignore-scripts` → validate → tests → regenerate/diff-zero → lock checks → package allowlist → secret/private-key scan → dual pack comparison → synthetic installer/lifecycle tests. Actions pinadas por commit e permissions deny-by-default.

### Release

Protected tag/commit → clean dual build → manifest/SBOM/checksums → protected Ed25519 signing → draft upload → redownload draft verify → immutable-support gate → independent checkpoint → publish → external redownload/reverify → evidence index.

Se immutable releases não estiver disponível, `publish` retorna `BLOCKED_IMMUTABILITY_UNAVAILABLE`; somente um control manifest aprovado por operação separada pode desbloquear.

## Observabilidade sanitizada

Eventos JSON Lines: timestamp, operation ID, command, phase, code, logical path/hash prefix, decision, duration e evidence ref. Redaction remove token, headers, private key, environment secrets, full prompts e conteúdo de arquivo. Human output referencia event IDs. Logs são append-only por operation e ligados ao receipt por hash.

## Códigos de erro e stop conditions

| Code | Classe | Ação |
|---|---|---|
| `SELECTION_NOT_REPORTED` | BLOCKED | registrar seleção |
| `RUNTIME_UNSUPPORTED` | NEEDS_STATE_VALIDATION | não instalar runtime |
| `SIGNATURE_INVALID` / `ASSET_HASH_MISMATCH` | BLOCKED | descartar staging |
| `SOURCE_MUTABLE` | BLOCKED | exigir release exata |
| `PATH_OUTSIDE_ROOT` / `SYMLINK_UNEXPECTED` / `TYPE_CONFLICT` | BLOCKED | sem write |
| `SNAPSHOT_DIVERGED` / `AUTHORIZATION_EXPIRED` | BLOCKED | novo plan/checkpoint |
| `LOCK_HELD` | BLOCKED | reconciliar writer |
| `PARTIAL_EFFECT` / `UNKNOWN_EFFECT` | BLOCKED | preservar e reconcile |
| `BACKUP_UNVERIFIED` | BLOCKED | não aplicar/rollback |
| `SELF_UPDATE_COMPLETED` | RESTART_REQUIRED | hard stop |
| `IMMUTABILITY_UNAVAILABLE` | BLOCKED | controle compensatório aprovado |
| `WINDOWS_HOST_NOT_VALIDATED` | PROJECTED | proibir claim validated |
| `CLEANUP_GATE_MISSING` | BLOCKED | preservar workspace |

Stop conditions incluem segredo detectado, private key no payload, dependency não aprovada, unsupported atomicity, material reproducibility drift e qualquer path fora de autorização.

## Threat model e controles negativos

| Ameaça | Controle/negative test |
|---|---|
| Substituição de release/tag | immutable gate, commit binding, Ed25519; tag moved fixture falha |
| Manifest/checksum adulterado | assinatura; bit flip falha |
| Archive traversal/symlink | contained extractor; malicious archives falham |
| Token/key leak | redaction + secret scan; seeded fixture falha |
| PR obtém signing secret | protected environment; fork simulation sem secret |
| TOCTOU no destino | snapshot+lock+prestate reread; mutation fault blocks |
| Retry após crash | intent journal + reconcile; unknown fixture não escreve |
| Uninstall apaga user data | ownership/after-hash; modified fixture preservada |
| PROJECT_UPDATE sobrescreve profile | user-owned policy; apply without merge/checkpoint fails |
| Cleanup prematuro | evidence-bound gates; missing gate blocks |
| Regras duplicadas em wrappers | contract test compares plans and scans duplicated constants |

## Compatibilidade e migração

- schema versions existentes continuam aceitos enquanto migration explícita estiver disponível;
- receipts v1 são lidos por adapter e migrados para representação interna sem rewrite silencioso;
- package `3.1.0` rejeita novos consumers de aliases legados conforme lifecycle v3.1 existente;
- source layout migration é copy/verify em sibling, não move;
- nenhuma claim Windows muda de `PROJECTED` sem evidence `VALIDATED_ON_HOST`.

## Rollback e uninstall do rollout

Antes de Git/release, rollback é descartar apenas o checkout irmão após verificação de ownership. Depois de release, rollback de release não move tag; publica nova versão corretiva. Instalação rollback usa receipts/backups, nunca Git. Uninstall segue ownership e retention; não equivale a apagar state histórico.

## Distinção de validação

- **PROJECTED:** contrato/design sem execução.
- **SYNTHETICALLY_VALIDATED:** testes em roots injetados/fixtures, não host global real.
- **VALIDATED_ON_HOST:** operação executada em host/plataforma declarados com evidence e hash.

Cada capability e asset registra esse nível. Ausência de host real não é convertida em claim.

## Estratégia de testes

- schemas: válido + um negativo por required/enum/binding;
- unit: canonical JSON, Ed25519, checksums, paths, locks, retention e state transitions;
- property/table: planner state matrix e idempotência;
- integration: install/update/reconcile/resume/rollback/uninstall em temp roots;
- fault injection: before/after intent/write/rename/sync/receipt/self-update;
- contract: bash/PowerShell→CLI e selection boundaries;
- security: traversal, symlink, case-fold, secret/key leakage, malicious archive;
- pipeline: immutable gate, untrusted PR, dual build, draft/redownload;
- archive: bundle verify e restore drill;
- host: Linux primeiro; Windows milestone separado.

## Rastreabilidade de design

| Requirements | Seções |
|---|---|
| SEL-* | Selection guidance flow; schemas |
| REP-* | Layout; fonte única; compatibility |
| ARC-* | Archive e migração |
| REL-* | Release contracts; Ed25519; pipeline |
| INS-* | CLI; download/installer; filesystem |
| LIF-* | State machines; lifecycle; retention |
| PRJ-* | PROJECT_UPDATE |
| PLT-* | Installers; validation levels |
| CICD-* | Pipeline; trust boundaries; threat model |
| CLN-* | Checkout irmão; archive/cleanup gates |
| NFR-*, BR-* | Boundaries; errors; observability; threat model |

## Decisões e gates

Não há decisão arquitetural aberta. São gates objetivos: disponibilidade dos repositórios, immutable release/controle compensatório, signing environment, fresh-install Linux, host Windows real, restore drill e cleanup evidence. Falha de gate bloqueia somente a operação correspondente.
