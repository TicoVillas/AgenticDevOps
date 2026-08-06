# Design — Layout global manifest-driven do framework v3

Status: FINAL  
Fase: spec  
Projeto: AgenticDevOps  
Slug: framework-v3-global-bootstrap-layout  
Estratégia: Design-First  
Linha de sessão: engenharia e autoria  
Sessão: engineering-author/framework-v3  
Modelo resolvido: GPT-5.6 Sol / High  
Agente/Workflow Kiro: Default  
Modo: Autopilot  
Origem: `discovery.md` — `APPROVED_FOR_SPEC`  
Última atualização: 2026-07-28

## Estratégia da Spec

**Estratégia:** Design-First.  
**Justificativa:** o modelo de carregamento do Kiro determina materialmente o layout e impede que um espelho físico de 63 arquivos seja tratado como instalação funcional.  
**Restrição determinante:** Skills globais são descobertas em `~/.kiro/skills/`; contexto persistente global é carregado de `~/.kiro/steering/`.  
**Impacto:** a arquitetura deve declarar exatamente 64 destinos, gerar um steering always-included e separar fontes, destinos, evidência operacional e operação real.  
**Decisões confirmadas:** manifest Kiro adapter-specific, tooling genérico, cinco classes, retirada futura dos nove steering v2.3 sem aliases, self-update por último, restart obrigatório e validação pós-restart em rodada separada.

## Estado atual relevante

- `framework.lock` protege 143 fontes, mas não representa destino, finalidade ou ordem de aplicação.
- O pacote v3 atual é íntegro e reproduz a árvore autorizada, mas não é instalável por contrato.
- `tools/lib/dry-run.mjs` classifica risco abstrato; não planeja itens de distribuição.
- `adapters/kiro/adapter.yaml` preserva o core e declara capacidades, mas não contém mapa global.
- `policies/ownership.yaml` não atribui ownership ao domínio de distribuição.
- Os geradores atuais não produzem o steering global `agentic-workflow.md`.
- Os 19 arquivos globais v2.3 permanecem intactos: dez Skills e nove steering.
- A raiz do projeto não é repositório Git. Rollback operacional não pode depender de Git.

## Objetivos de design

1. Formalizar toda fonte do pacote em um catálogo versionado e classificado.
2. Fixar exatamente 64 arquivos globais gerenciados por mapeamento source → destination.
3. Fazer o Kiro carregar um entrypoint fino sem criar segunda autoridade normativa.
4. Produzir plano read-only, determinístico e fail-closed antes de qualquer escrita.
5. Separar aplicação pré-restart e validação pós-restart.
6. Tornar backup, receipt, falha parcial, retomada, idempotência e rollback verificáveis.
7. Manter operação real, migração de projeto, Git e adapters não Kiro fora da implementação local.

## Interpretação vinculante do inventário

Os 63 destinos aprovados incluem os 25 arquivos preexistentes em `contracts/**`, inclusive seus schemas e templates. A decisão de manter “manifest, schema, planner, validator, templates, testes e fixtures” fora dos 64 aplica-se aos **novos artefatos de controle introduzidos por esta entrega**. Ela não remove retroativamente arquivos dos 63 já aprovados.

O manifest terá dois eixos separados:

- `source_catalog`: classifica todas as fontes protegidas por `framework.lock`, inclusive `SOURCE_ONLY` e `BUILD_TEST_ONLY`;
- `managed_items`: referencia exatamente 64 entradas instaláveis.

Assim, um arquivo pode ser `GENERATED_PACKAGE_CONTENT` no catálogo e ainda possuir destino global gerenciado, sem criar uma sexta classe.

## Arquitetura da solução

```text
fontes canônicas + geradores
        │
        ▼
framework.lock ───────┐
        │              │
        ▼              ▼
distribution-manifest.yaml + schema tool-neutral
        │
        ├── validator estrutural/semântico (read-only)
        ├── gerador determinístico do steering
        └── planner read-only
                 │
                 ▼
          plano + snapshot
                 │
       checkpoint operacional futuro
                 │
                 ▼
Etapa A: backup → apply → retire legacy → self-update → RESTART_REQUIRED
                 │
                 X  nenhuma continuação automática
                 │
                 ▼
Etapa B: nova execução pós-restart → 64/64 → loader → idempotência → receipt final
```

## Boundaries

| Boundary | Origem | Destino | Confiança | Controle | Falha |
|---|---|---|---|---|---|
| Fonte → catálogo | árvore `framework/` | manifest | fonte local verificada | `framework.lock`, containment, classificação total | `BLOCKED` |
| Catálogo → destino | `managed_items` | raiz global simbólica | destino não confiável até `lstat` | allowlist, realpath, no-follow | `BLOCKED` |
| Gerador → steering | template/config/core | generated content | saída derivada | geração determinística + hash | `BLOCKED` por drift |
| Planner → plano | manifest + snapshot | objeto em memória/evidência | read-only | sem mutação, decisão calculada | `BLOCKED` |
| Apply → global | plano autorizado | `~/.kiro/**` | alto risco | checkpoint, backup, WAL, snapshot | `PARTIAL`/`BLOCKED` |
| Etapa A → B | status em tela + journal externo | nova execução | sessão anterior não é autoridade | restart real e reconciliação | `BLOCKED` |
| Receipt → auditoria | ações observadas | arquivo externo | derivado | só ações concluídas, hash, sanitização | `BLOCKED` por inconsistência |

## Componentes afetados

### Principais

- `framework/adapters/kiro/distribution-manifest.yaml` — instância adapter-specific.
- `framework/contracts/schemas/distribution-manifest.schema.yaml` — estrutura tool-neutral.
- `framework/tools/lib/distribution.mjs` — catálogo, geração, validação semântica e planner read-only.
- `framework/tools/validate-distribution.mjs` — CLI read-only e integração com `validate-all`.
- `framework/adapters/kiro/templates/agentic-workflow.md` — template SOURCE_ONLY.
- `framework/adapters/kiro/generated/agentic-workflow.md` — saída determinística e 64ª fonte instalável.
- `framework/skills/workflow-bootstrap/SKILL.md` — consumidor do plano e item de self-update.

### Suporte operacional local

- `framework/tools/lib/installation.mjs` — snapshot, backup, journal, receipt, apply, resume e rollback com raízes injetadas.
- Schemas tool-neutral para backup manifest, journal e receipt em `framework/contracts/schemas/` quando a implementação confirmar documentos persistentes independentes.
- Templates operacionais correspondentes em `framework/contracts/templates/`, todos SOURCE_ONLY.
- `framework/tools/validate-all.mjs`, `framework/package.json`, `framework/framework.lock` e pacote local.

### Testes

- `framework/tests/distribution/**` e fixtures sintéticas.
- Regressões nos testes de contracts, adapters, compatibility, skills, dry-run e source-lock.

### Proibidos nesta entrega de implementação local

- `/home/villas/.kiro/**`;
- `.kiro/specs/framework-v3/**`;
- `Kiro_v2_3_source/**`, `Kiro_v2_4_source/**`, `Analise_Workflow_v3.0.md`;
- ChatGPT Project, `.agentic/`, Git e remoto.

## Contrato do distribution manifest

### Envelope versionado

```yaml
schema_version: 1
framework_version: 3.0.0
adapter: kiro
manifest_id: kiro-global-v3
source_root: FRAMEWORK_ROOT
destination_root: KIRO_GLOBAL_ROOT
expected_managed_files: 64
source_catalog: []
managed_items: []
legacy_retirements: []
operation:
  self_update_item: skill-workflow-bootstrap
  restart_status: RESTART_REQUIRED
```

### `source_catalog`

Cada entrada exige:

```yaml
id: string-estável
path: caminho-relativo-normalizado
version: 3.0.0
sha256: hash-64-hex
class: GLOBAL_KIRO_MANAGED | SOURCE_ONLY | PROJECT_TEMPLATE | GENERATED_PACKAGE_CONTENT | BUILD_TEST_ONLY
generated_from: []          # obrigatório para conteúdo gerado
adapter_scope: kiro | universal | none
```

Invariantes:

- todo arquivo de fonte protegido pelo lock possui exatamente uma classificação;
- `sha256` deve igualar `framework.lock[path]`;
- nenhuma fonte desbloqueada, ausente ou duplicada é aceita;
- `generated_from` referencia apenas fontes catalogadas e seus hashes participam da reprodução;
- novos artefatos de distribuição/control plane são `SOURCE_ONLY` ou `BUILD_TEST_ONLY`, salvo a saída gerada do steering;
- o próprio manifest é fonte catalogada, mas sua integridade é registrada exclusivamente pelo `framework.lock` externo: o manifest não embute o próprio hash de forma recursiva, e os hashes de conteúdo gerado são calculados na ordem gerar → lock → pacote, evitando dependência circular ou hash recursivo impraticável.

### `managed_items`

Cada uma das 64 entradas exige:

```yaml
id: string-estável
source_id: referência-ao-catálogo
destination: caminho-relativo-à-raiz-global
owner: INSTALLING_USER
group: INSTALLING_PRIMARY_GROUP
mode: '0644'
apply_phase: SUPPORT | ADAPTER | SKILL_REFERENCE | SKILL | ENTRYPOINT | SELF_UPDATE
depends_on: []
self_update: false
loader_role: NONE | ROUTER | SKILL | STEERING_ENTRYPOINT
```

Regras de metadados:

- em Linux, arquivos esperam owner `INSTALLING_USER`, group `INSTALLING_PRIMARY_GROUP` e mode `0644`;
- diretórios criados pelo lote usam `0755`, não contam entre os 64 e nunca são removidos se contiverem conteúdo não gerenciado;
- em plataformas sem semântica POSIX, owner/group/mode são `NOT_APPLICABLE` na observação, sem desativar containment e ACL segura;
- timestamps não são critério de identidade e não devem mudar em `NO_CHANGE`.

### `legacy_retirements`

Contém exatamente nove paths:

1. `steering/workflow-core.md`;
2. `steering/contracts/ArtifactContract.md`;
3. `steering/contracts/ContextPolicy.md`;
4. `steering/contracts/EvidenceAndFeedbackContract.md`;
5. `steering/contracts/ExecutionEnvironmentPolicy.md`;
6. `steering/contracts/GitSafetyPolicy.md`;
7. `steering/contracts/HighRiskOverlay.md`;
8. `steering/contracts/ModelSelectionPolicy.md`;
9. `steering/contracts/SecureDevelopmentPolicy.md`.

Cada entrada contém hash baseline v2.3, `required_state: LEGACY_ACTIVE_CONFLICT`, `backup_required: true`, `remove_only_if_exact: true` e nenhuma substituição por alias/stub/redirect.

## Mapa completo dos 64 itens

Convenções da tabela:

- versão de todas as fontes: `3.0.0`;
- hash: `LOCK(source)`, igualdade obrigatória com `framework.lock` após geração;
- owner/group/mode: `INSTALLING_USER` / `INSTALLING_PRIMARY_GROUP` / `0644`;
- destinos são relativos a `~/.kiro/`;
- `GKM` = `GLOBAL_KIRO_MANAGED`; `GPC` = `GENERATED_PACKAGE_CONTENT`.

| # | ID | Source | Destination | Classe | Fase |
|---:|---|---|---|---|---|
| 1 | core-workflow-router | `core/WorkflowRouter.md` | `core/WorkflowRouter.md` | GKM | SUPPORT |
| 2 | core-roles | `core/roles.yaml` | `core/roles.yaml` | GKM | SUPPORT |
| 3 | core-statuses | `core/statuses.yaml` | `core/statuses.yaml` | GKM | SUPPORT |
| 4 | core-workflow-core | `core/workflow-core.md` | `core/workflow-core.md` | GKM | SUPPORT |
| 5 | core-workflow | `core/workflow.yaml` | `core/workflow.yaml` | GKM | SUPPORT |
| 6 | policy-capability | `policies/CapabilitySelectionPolicy.md` | `policies/CapabilitySelectionPolicy.md` | GKM | SUPPORT |
| 7 | policy-context | `policies/ContextPolicy.md` | `policies/ContextPolicy.md` | GKM | SUPPORT |
| 8 | policy-environment | `policies/ExecutionEnvironmentPolicy.md` | `policies/ExecutionEnvironmentPolicy.md` | GKM | SUPPORT |
| 9 | policy-git | `policies/GitSafetyPolicy.md` | `policies/GitSafetyPolicy.md` | GKM | SUPPORT |
| 10 | policy-high-risk | `policies/HighRiskOverlay.md` | `policies/HighRiskOverlay.md` | GKM | SUPPORT |
| 11 | policy-security | `policies/SecureDevelopmentPolicy.md` | `policies/SecureDevelopmentPolicy.md` | GKM | SUPPORT |
| 12 | policy-profile-matrix | `policies/application-profile-matrix.yaml` | `policies/application-profile-matrix.yaml` | GKM | SUPPORT |
| 13 | policy-dry-run | `policies/dry-run-rules.yaml` | `policies/dry-run-rules.yaml` | GKM | SUPPORT |
| 14 | policy-ownership | `policies/ownership.yaml` | `policies/ownership.yaml` | GKM | SUPPORT |
| 15 | policy-security-outcomes | `policies/security-outcomes.yaml` | `policies/security-outcomes.yaml` | GKM | SUPPORT |
| 16 | contract-artifact | `contracts/ArtifactContract.md` | `contracts/ArtifactContract.md` | GKM | SUPPORT |
| 17 | contract-evidence | `contracts/EvidenceAndFeedbackContract.md` | `contracts/EvidenceAndFeedbackContract.md` | GKM | SUPPORT |
| 18 | schema-profile-override | `contracts/schemas/application-profile.override.schema.yaml` | `contracts/schemas/application-profile.override.schema.yaml` | GKM | SUPPORT |
| 19 | schema-profile | `contracts/schemas/application-profile.schema.yaml` | `contracts/schemas/application-profile.schema.yaml` | GKM | SUPPORT |
| 20 | schema-artifact | `contracts/schemas/artifact.schema.yaml` | `contracts/schemas/artifact.schema.yaml` | GKM | SUPPORT |
| 21 | schema-core-roles | `contracts/schemas/core/roles.schema.yaml` | `contracts/schemas/core/roles.schema.yaml` | GKM | SUPPORT |
| 22 | schema-core-statuses | `contracts/schemas/core/statuses.schema.yaml` | `contracts/schemas/core/statuses.schema.yaml` | GKM | SUPPORT |
| 23 | schema-core-workflow | `contracts/schemas/core/workflow.schema.yaml` | `contracts/schemas/core/workflow.schema.yaml` | GKM | SUPPORT |
| 24 | schema-design | `contracts/schemas/design.schema.yaml` | `contracts/schemas/design.schema.yaml` | GKM | SUPPORT |
| 25 | schema-dry-run | `contracts/schemas/dry-run-manifest.schema.yaml` | `contracts/schemas/dry-run-manifest.schema.yaml` | GKM | SUPPORT |
| 26 | schema-evidence-envelope | `contracts/schemas/evidence-envelope.schema.yaml` | `contracts/schemas/evidence-envelope.schema.yaml` | GKM | SUPPORT |
| 27 | schema-evidence | `contracts/schemas/evidence.schema.yaml` | `contracts/schemas/evidence.schema.yaml` | GKM | SUPPORT |
| 28 | schema-execution-brief | `contracts/schemas/execution-brief.schema.yaml` | `contracts/schemas/execution-brief.schema.yaml` | GKM | SUPPORT |
| 29 | schema-finding | `contracts/schemas/finding.schema.yaml` | `contracts/schemas/finding.schema.yaml` | GKM | SUPPORT |
| 30 | schema-requirements | `contracts/schemas/requirements.schema.yaml` | `contracts/schemas/requirements.schema.yaml` | GKM | SUPPORT |
| 31 | schema-review | `contracts/schemas/review.schema.yaml` | `contracts/schemas/review.schema.yaml` | GKM | SUPPORT |
| 32 | schema-tasks | `contracts/schemas/tasks.schema.yaml` | `contracts/schemas/tasks.schema.yaml` | GKM | SUPPORT |
| 33 | schema-transition | `contracts/schemas/transition-manifest.schema.yaml` | `contracts/schemas/transition-manifest.schema.yaml` | GKM | SUPPORT |
| 34 | template-profile-override | `contracts/templates/application-profile.override.yaml` | `contracts/templates/application-profile.override.yaml` | GKM | SUPPORT |
| 35 | template-profile | `contracts/templates/application-profile.yaml` | `contracts/templates/application-profile.yaml` | GKM | SUPPORT |
| 36 | template-artifact | `contracts/templates/artifact.yaml` | `contracts/templates/artifact.yaml` | GKM | SUPPORT |
| 37 | template-dry-run | `contracts/templates/dry-run-manifest.yaml` | `contracts/templates/dry-run-manifest.yaml` | GKM | SUPPORT |
| 38 | template-evidence-envelope | `contracts/templates/evidence-envelope.yaml` | `contracts/templates/evidence-envelope.yaml` | GKM | SUPPORT |
| 39 | template-finding | `contracts/templates/finding.yaml` | `contracts/templates/finding.yaml` | GKM | SUPPORT |
| 40 | template-transition | `contracts/templates/transition-manifest.yaml` | `contracts/templates/transition-manifest.yaml` | GKM | SUPPORT |
| 41 | skill-bug-fix-ref | `skills/bug-fix/references/causality.md` | `skills/bug-fix/references/causality.md` | GKM | SKILL_REFERENCE |
| 42 | skill-bug-fix | `skills/bug-fix/SKILL.md` | `skills/bug-fix/SKILL.md` | GKM | SKILL |
| 43 | skill-contract-review-ref | `skills/contract-review/references/ledger.md` | `skills/contract-review/references/ledger.md` | GKM | SKILL_REFERENCE |
| 44 | skill-contract-review | `skills/contract-review/SKILL.md` | `skills/contract-review/SKILL.md` | GKM | SKILL |
| 45 | skill-correction-ref | `skills/correct-from-validation/references/correction.md` | `skills/correct-from-validation/references/correction.md` | GKM | SKILL_REFERENCE |
| 46 | skill-correction | `skills/correct-from-validation/SKILL.md` | `skills/correct-from-validation/SKILL.md` | GKM | SKILL |
| 47 | skill-closeout-ref | `skills/delivery-closeout/references/remote.md` | `skills/delivery-closeout/references/remote.md` | GKM | SKILL_REFERENCE |
| 48 | skill-closeout | `skills/delivery-closeout/SKILL.md` | `skills/delivery-closeout/SKILL.md` | GKM | SKILL |
| 49 | skill-execute-ref | `skills/execute-contract/references/checkpoints.md` | `skills/execute-contract/references/checkpoints.md` | GKM | SKILL_REFERENCE |
| 50 | skill-execute | `skills/execute-contract/SKILL.md` | `skills/execute-contract/SKILL.md` | GKM | SKILL |
| 51 | skill-discovery-ref | `skills/low-level-discovery/references/investigation.md` | `skills/low-level-discovery/references/investigation.md` | GKM | SKILL_REFERENCE |
| 52 | skill-discovery | `skills/low-level-discovery/SKILL.md` | `skills/low-level-discovery/SKILL.md` | GKM | SKILL |
| 53 | skill-quick-spec-ref | `skills/quick-spec/references/proportionality.md` | `skills/quick-spec/references/proportionality.md` | GKM | SKILL_REFERENCE |
| 54 | skill-quick-spec | `skills/quick-spec/SKILL.md` | `skills/quick-spec/SKILL.md` | GKM | SKILL |
| 55 | skill-spec-ref | `skills/spec/references/architecture.md` | `skills/spec/references/architecture.md` | GKM | SKILL_REFERENCE |
| 56 | skill-spec | `skills/spec/SKILL.md` | `skills/spec/SKILL.md` | GKM | SKILL |
| 57 | skill-validation-ref | `skills/validate-delivery/references/evidence.md` | `skills/validate-delivery/references/evidence.md` | GKM | SKILL_REFERENCE |
| 58 | skill-validation | `skills/validate-delivery/SKILL.md` | `skills/validate-delivery/SKILL.md` | GKM | SKILL |
| 59 | skill-bootstrap-ref | `skills/workflow-bootstrap/references/migration.md` | `skills/workflow-bootstrap/references/migration.md` | GKM | SKILL_REFERENCE |
| 60 | skill-bootstrap | `skills/workflow-bootstrap/SKILL.md` | `skills/workflow-bootstrap/SKILL.md` | GKM | SELF_UPDATE |
| 61 | adapter-kiro | `adapters/kiro/adapter.yaml` | `adapters/kiro/adapter.yaml` | GKM | ADAPTER |
| 62 | adapter-kiro-lifecycle | `adapters/kiro/compatibility-lifecycle.yaml` | `adapters/kiro/compatibility-lifecycle.yaml` | GKM | ADAPTER |
| 63 | adapter-kiro-router-alias | `adapters/kiro/generated/DiscoveryRouter.md` | `adapters/kiro/generated/DiscoveryRouter.md` | GPC | ADAPTER |
| 64 | adapter-kiro-steering | `adapters/kiro/generated/agentic-workflow.md` | `steering/agentic-workflow.md` | GPC | ENTRYPOINT |

Dependências:

- SUPPORT precede ADAPTER, SKILL_REFERENCE, SKILL e ENTRYPOINT;
- cada SKILL depende de sua referência e dos contratos/políticas que usa;
- ENTRYPOINT depende do core/router, adapter e dez Skills staged/validados;
- retirada de legado depende de backup completo e ENTRYPOINT aplicado/verificado;
- SELF_UPDATE depende de todas as outras ações e é a última escrita da Etapa A.

## Geração determinística do steering

Fonte proposta: `adapters/kiro/templates/agentic-workflow.md`.  
Saída: `adapters/kiro/generated/agentic-workflow.md`.  
Destino: `~/.kiro/steering/agentic-workflow.md`.

Conteúdo permitido:

```markdown
---
inclusion: always
---
# Agentic workflow entrypoint
Use o core/router global v3 e carregue exatamente a Skill aplicável ao papel/fase atual.
```

O texto final deve usar referências adapter-specific válidas para os destinos globais. O gerador:

- ordena campos e termina com uma única newline;
- não inclui timestamp, host ou path absoluto;
- inclui comentário de provenance/DO NOT EDIT;
- rejeita inclusão literal de workflow, políticas ou contratos completos;
- produz o mesmo hash para as mesmas fontes;
- atualiza generated output antes de `framework.lock` e do pacote.

## Estados de destino e classificação de conflitos

| Estado | Condição | Ação padrão |
|---|---|---|
| `ABSENT` | path não existe | `CREATE`, após autorização |
| `IDENTICAL` | bytes e metadados aceitos | `NO_CHANGE` |
| `MANAGED_OUTDATED` | hash corresponde a versão gerenciada conhecida | `BACKUP_UPDATE`, após autorização |
| `MANAGED_DIVERGENT` | receipt/versão conhecida, conteúdo local modificado | `BLOCKED` |
| `METADATA_DIVERGENT` | bytes idênticos, owner/group/mode divergentes | checkpoint; nunca alterar silenciosamente |
| `LEGACY_ACTIVE_CONFLICT` | um dos nove paths com hash baseline exato | `BACKUP_RETIRE`, somente lote autorizado |
| `LEGACY_MODIFIED` | path legado diverge do baseline | `BLOCKED` |
| `UNMANAGED_PRESENT` | path sem provenance gerenciada | `BLOCKED` e preservar |
| `SYMLINK_UNEXPECTED` | `lstat` encontra symlink | `BLOCKED` |
| `TYPE_CONFLICT` | destino não é arquivo regular esperado | `BLOCKED` |
| `OUTSIDE_ROOT` | realpath/ancestral escapa raiz | `BLOCKED` |
| `SOURCE_HASH_MISMATCH` | fonte difere de lock/manifest | `BLOCKED` |
| `UNKNOWN_PARTIAL` | efeito anterior não reconciliável | `BLOCKED` |

Arquivo localmente modificado nunca é sobrescrito nem removido por classificação heurística. Uma reconciliação material exige decisão e autorização separadas.

## Planner read-only

API conceitual:

```js
validateDistributionManifest({ root, manifest, lock })
renderKiroSteering({ template, inputs })
buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest })
classifyDistributionState({ manifest, snapshot, priorReceipt })
planDistribution({ manifest, snapshot, authorization })
```

Propriedades:

- nenhuma escrita, criação de temporário, chmod, chown ou remoção;
- raízes, filesystem e clock injetáveis para teste;
- resultado ordenado por dependência e ID;
- decisão global `BLOCKED` se qualquer item estiver fora de controle;
- dry-run compatível com `classifyDryRun`, sempre `CHECKPOINT_REQUIRED` para raiz global;
- inclui predicted effects, legacy retirements, backup set, self-update e stop criteria;
- snapshot hash cobre paths, tipo, bytes/hash, mode, UID/GID e estado de presença, não timestamps mutáveis.

## Validator do manifest

Validação estrutural:

- schema version conhecida;
- enums fechados;
- paths relativos normalizados;
- hashes hex de 64 caracteres;
- IDs únicos e referências existentes.

Validação semântica:

- catálogo completo em relação a `framework.lock`;
- exatamente 64 `managed_items` e 64 destinations únicas;
- mapa idêntico à tabela vinculante;
- exatamente um steering `inclusion: always`;
- exatamente um `self_update: true`, apontando a `workflow-bootstrap/SKILL.md`;
- self-update topologicamente último;
- nenhum SOURCE_ONLY/BUILD_TEST_ONLY novo em `managed_items`;
- nenhum adapter diferente de Kiro;
- nove legacy retirements exatos, sem diretório ou glob;
- nenhuma dependência cíclica;
- pacote, lock, generated output e manifest reconciliados.

## Artefatos operacionais derivados

### Snapshot

Registro read-only de pre-state por path: presença, tipo, hash, mode, UID/GID, managed provenance e snapshot hash agregado.

### Backup manifest externo

Criado sob `<backup-root>/<operation-id>/backup-manifest.yaml`, fora de `~/.kiro`. Registra somente itens que podem ser alterados/removidos, origem, backup, hash, bytes/tamanho, tipo, mode, UID/GID e verificação. Backup incompleto ou não verificável bloqueia apply.

### Journal

Write-ahead log externo com estados `PLANNED`, `BACKED_UP`, `APPLYING`, `APPLIED`, `VERIFIED`, `FAILED_KNOWN`, `UNKNOWN`. Intent pode ser registrado antes da ação; conclusão somente depois da verificação.

### `installation-receipt.yaml`

Registra apenas ações já executadas e verificadas, com operation ID, manifest/lock/package hashes, snapshot, timestamps operacionais, paths, before/after hashes e metadados, autorização e status. Não é instalado nem normativo.

Antes do self-update, o receipt contém as ações concluídas e `pending_action: skill-workflow-bootstrap`; não declara essa ação como executada. Após o self-update não ocorre escrita na Etapa A. Na Etapa B, a nova execução reconcilia o hash efetivo e finaliza o receipt.

## Etapa A — aplicação pré-restart

Pré-condições:

- operação global explicitamente autorizada em modo supervisionado;
- nenhuma nova sessão Kiro iniciada durante a janela;
- manifest/lock/pacote/gerados válidos;
- snapshot atual igual ao aprovado;
- plano sem `BLOCKED`;
- backup externo completo e verificado;
- rollback plausível;
- paths e nove remoções explicitamente confirmados.

Ordem:

1. revalidar snapshot e autorização;
2. criar backup e verificar cada entrada;
3. criar journal/receipt externo;
4. aplicar SUPPORT, ADAPTER, SKILL_REFERENCE e Skills não-self-update;
5. aplicar e verificar `agentic-workflow.md`;
6. retirar exatamente os nove steering v2.3, sem remover diretórios compartilhados;
7. verificar 63 itens não-self-update e ausência dos nove legados;
8. atualizar receipt apenas com ações concluídas e marcar self-update pendente;
9. substituir atomicamente `workflow-bootstrap/SKILL.md` como última escrita;
10. não escrever arquivo, journal, receipt ou evidência adicional;
11. retornar `RESTART_REQUIRED` em stdout/status e encerrar.

Se o self-update falhar antes de substituir, o estado permanece conhecido e exige reconciliação. Se a substituição for confirmada, nenhuma ação adicional é permitida nessa execução.

## Etapa B — validação pós-restart

É uma nova execução explicitamente iniciada após restart; não é encadeada pela Etapa A.

1. confirmar processo/sessão novos e Skill v3 carregada;
2. reconciliar journal, receipt e self-update;
3. confirmar 64/64 paths, hashes, owner/group/mode aplicáveis;
4. confirmar referências relativas;
5. confirmar `agentic-workflow.md` carregado;
6. confirmar descoberta/carregamento das dez Skills;
7. confirmar ausência dos nove steering e de mixed authority;
8. executar planner/dry-run novamente e exigir 64 `NO_CHANGE`;
9. verificar rollback contra backup sem executá-lo, salvo autorização própria;
10. finalizar receipt e evidência pós-restart;
11. só então declarar instalação global concluída.

## Falha parcial e retomada segura

- Toda mutação, exceto a última self-update, é precedida por intent no journal e seguida por verificação.
- Retry só é permitido para `KNOWN_RECOVERABLE` após comparar fonte, destino, backup, journal e receipt.
- `UNKNOWN` ou timeout com efeito incerto bloqueia; não há repetição cega.
- Resume recompõe o plano a partir do estado real, nunca apenas do passo salvo.
- Se snapshot ou autorização mudarem, a rodada expira.
- Falha antes do self-update mantém a Skill antiga e permite rollback autorizado.
- Falha confirmada no self-update exige restart/reconciliação; não permite continuar na mesma execução.

## Rollback

Rollback é plano derivado do backup manifest e journal:

- restaura apenas paths alterados pelo operation ID;
- compara o estado atual com o after-hash antes de restaurar;
- restaura bytes, mode e ownership capturados;
- remove arquivo criado somente quando pre-state era `ABSENT` e o conteúdo atual ainda é o aplicado;
- restaura os nove steering somente pelos backups exatos;
- não depende de Git;
- não remove diretório compartilhado;
- não alcança unmanaged;
- produz receipt próprio;
- operação real exige autorização separada e checkpoint.

## Idempotência e segunda execução

Após Etapa B aprovada:

- todos os 64 itens classificam como `IDENTICAL`/`NO_CHANGE`;
- os nove legacy paths classificam como ausentes esperados, não ação pendente;
- nenhum arquivo, mode, owner/group ou timestamp é alterado;
- nenhum backup novo é criado;
- nenhum self-update é reexecutado;
- o planner retorna plano vazio de mutação e evidência determinística.

## Segurança

| Risco | Controle | Teste negativo | Evidência esperada |
|---|---|---|---|
| path traversal/escape | normalização + containment real | `../`, absoluto, ancestral symlink | decisão `BLOCKED` |
| symlink inesperado | `lstat`, no-follow | symlink em source/destination/parent | decisão `BLOCKED` |
| fonte adulterada | lock + manifest + pacote | hash divergente | zero escrita |
| remoção de unmanaged | allowlist de nove paths | arquivo extra em steering | preservado |
| backup incompleto | verificação antes de apply | entrada ausente/corrompida | apply bloqueado |
| receipt falso | registrar só after-state verificado | ação planejada não executada | ausente de `executed` |
| adapter errado | `adapter: kiro` + allowlist | ChatGPT/Codex/Claude | validação falha |
| source-only instalado | cross-check catálogo/items | incluir teste/manifest/schema novo | validação falha |
| mixed authority | entrypoint + retirada exata | um steering v2.3 remanescente | Etapa B falha |
| self-update continua | hard stop no executor | escrita após item self-update | teste falha |
| retry inseguro | reconciliação obrigatória | estado parcial desconhecido | `BLOCKED` |

## Compatibilidade e preservações

- `.agentic` permanece raiz canônica de projeto; esta entrega não migra projetos.
- `.kiro` de projeto permanece compatibilidade não normativa.
- `DiscoveryRouter.md` permanece alias gerado com lifecycle v3.0/v3.1/v3.2; não é um dos nove steering v2.3.
- `npm run validate` e `npm test` devem continuar aprovados.
- Core permanece tool-neutral; paths e semântica Kiro ficam no adapter/manifest.
- Nenhuma dependência nova é prevista; usar Node 24, `node:fs`, `node:path`, `node:crypto`, Ajv e YAML existentes.
- Pacote e `framework.lock` devem permanecer reproduzíveis após regeneração autorizada.
- Árvores v2.3/v2.4 e análise v3 permanecem read-only.

## Estratégia de testes

### Unitários/contrato

- schema válido e todos os campos/enums;
- catálogo completo e mapa 64 exato;
- source ausente, hash divergente e source-only em managed items;
- destination absoluto/traversal/duplicado;
- self-update ausente ou fora da última posição;
- steering determinístico, fino e sem conteúdo normativo duplicado.

### Integração em roots sintéticas

- destino ausente, idêntico, managed outdated, managed divergent e unmanaged;
- symlink em source, destino e ancestral;
- legacy idêntico/modificado;
- backup incompleto;
- falha injetada antes/depois de cada write;
- apply parcial, resume e rollback integral;
- diretório compartilhado com arquivo não gerenciado;
- timestamps preservados em `NO_CHANGE`;
- nenhum adapter não Kiro ou arquivo BUILD_TEST_ONLY/SOURCE_ONLY copiado.

### Regressão

- `npm run validate`;
- `npm test`;
- Skills e progressive loading;
- compatibility lifecycle 3.0/3.1/3.2;
- source lock drift/unlocked;
- pacote local reproduzível por conteúdo/hash conforme comando oficial;
- dry-run fail-closed.

### Runtime pós-restart

Somente em futura Etapa B: steering carregável, dez Skills carregáveis, referências resolvidas, 64/64, mixed authority ausente e segundo dry-run idempotente.

## Checkpoints

### CP-01 — contrato local antes da execução

- **Estado:** manifest/schema/mapa 64/tasks finais após Contract Review.
- **Critério:** contrato `FINAL_READY_FOR_EXECUTION`.
- **Não autoriza:** implementação ou operação global por si só.

### CP-02 — implementação local concluída

- **Estado:** validators/testes/pacote em roots sintéticas e `EXECUTION.md`.
- **Critério:** validação independente da entrega local.
- **Não autoriza:** tocar `~/.kiro`.

### CP-03 — operação global futura

- **Estado:** plano, snapshot, backup target, rollback, 64 itens e nove retirements.
- **Critério:** autorização humana específica para Etapa A.
- **Modo:** Supervised.

### CP-04 — restart

- **Estado:** self-update foi última escrita e status `RESTART_REQUIRED`.
- **Critério:** restart humano; nenhuma continuação automática.

### CP-05 — validação pós-restart

- **Estado:** nova execução e evidência 64/64.
- **Critério:** Etapa B aprovada antes do piloto.

### CP-06 — piloto AgenticDevOps

- **Estado:** instalação global validada.
- **Critério:** autorização própria para `PROJECT_UPDATE`.

## Critérios de interrupção

- mapa diferente de 64 ou destino fora da tabela;
- fonte/lock/pacote/manifest divergente;
- symlink, traversal, tipo inesperado ou raiz ambígua;
- arquivo unmanaged em destino pretendido;
- legacy modificado;
- backup incompleto;
- snapshot ou autorização alterados;
- efeito parcial desconhecido;
- self-update não sendo a última escrita;
- necessidade de instalar adapter não Kiro;
- tentativa de incluir SOURCE_ONLY/BUILD_TEST_ONLY novo nos destinos;
- operação global durante implementação/validação local;
- qualquer decisão material nova.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| mapa 63/64 incorreto | instalação não funcional | validator exige tabela exata e entrypoint |
| steering vira segunda autoridade | drift normativo | conteúdo fino, gerado e teste anti-duplicação |
| mixed authority v2.3/v3 | comportamento contraditório | retirada exata + Etapa B |
| self-update quebra executor | estado parcial | última escrita + hard stop + restart |
| overwrite de customização | perda de trabalho | provenance, hash, fail-closed |
| rollback incompleto | instalação irrecuperável | backup verificado + journal/receipt |
| cross-platform diverge | paths/permissões incorretos | abstração de filesystem e fixtures Linux/Windows |
| pacote difere do validado | supply-chain | lock/package/manifest reconciliados |

## Alternativas rejeitadas

- inferir destinos na Skill;
- usar `framework.lock` como manifest;
- instalar somente 63 itens;
- copiar contratos completos para steering;
- manter alias/stub/redirect dos nove steering;
- executar Etapa B automaticamente;
- registrar self-update como executado antes de observá-lo;
- rollback via Git;
- remover diretórios compartilhados;
- instalar adapters ChatGPT/Codex/Claude.

## Decisões de design

- `source_catalog` e `managed_items` são conjuntos separados.
- O mapa da tabela é vinculante e contém 64 entradas.
- O 64º source gerado fica em `adapters/kiro/generated/agentic-workflow.md`.
- Novos artefatos de controle são source/build only.
- Owner/group são simbólicos e resolvidos no host; mode de arquivo é `0644`.
- Planner é read-only; apply usa módulo distinto.
- Receipt pré-restart não antecipa self-update; conclusão ocorre na Etapa B.
- Etapa A e Etapa B são execuções distintas.
- Não há pendência material para Contract Review; detalhes de naming de schemas operacionais podem ser corrigidos pelo reviewer somente se não alterarem comportamento ou escopo.
