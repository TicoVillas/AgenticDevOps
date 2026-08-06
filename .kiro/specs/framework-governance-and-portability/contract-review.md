# Contract Review — Framework Governance and Portability

## Cabeçalho de artefato

```yaml
version: 1
type: CONTRACT_REVIEW
status: APPROVED
metadata:
  project: AgenticDevOps
  slug: framework-governance-and-portability
  phase: contract-review/round-01
  role: CONTRACT_ASSURANCE
  overlay: HighRiskOverlay
  session_strategy: original_reviewer_session
  author_session: sess_04e851e5-483e-4521-a586-ea3e096e5723
  reviewer_independence: SATISFIED
  rounds:
    - round-01 (initial): APPROVED_WITH_NON_MATERIAL_FIXES
    - follow-up-01: APPROVED
sections:
  - selection
  - preflight
  - confrontation
  - findings
  - decision
  - follow-up
  - limitations
  - disposition
current_bindings:
  discovery.md: d9b40cdcab92dd01bea55918beff7ceb8e164a49b455471fa6a54f5d8ef0be77
  requirements.md: fe83db42aa19de992ceb90291d5db4caa69fcbf35e315e9d1fc1692ff4598aa2
  design.md: 46532b9e7e43ff7626bbedc1e040dbf6af1e343502b99b5242d52e31146cd056
  tasks.md: 3e18e3d22902bf96befa9440f354fd21690bb0828de4a9b69c9514db6b45797c
  execution-brief.md: a3a0381107a3b529e35948609ed2b47034f7c82330c826ba5e82d5acc1a21d95
```

## Identificação

- **Fase:** `contract-review`
- **Rodadas:** `round-01` (inicial) e `follow-up-01`
- **Papel:** `CONTRACT_ASSURANCE`
- **Slug:** `framework-governance-and-portability`
- **Overlay:** `HighRiskOverlay`
- **Estratégia de sessão:** revisão inicial em sessão nova e independente; follow-up retomado
  na sessão revisora original. Sessão autora `sess_04e851e5-483e-4521-a586-ea3e096e5723`
  confirmada como distinta em ambas as rodadas.
- **Artefato canônico deste review:**
  `.kiro/specs/framework-governance-and-portability/contract-review.md`
- **Autorização de escrita:** somente este artefato.

## Seleção efetiva registrada antes do preflight (round-01)

```yaml
selection_guidance:
  recommended:
    family: Claude
    model: Claude Opus 5
    effort: HIGH
    agent_workflow: Kiro Default
    mode: AUTOPILOT
  fallback_guidance:
    family: Claude
    model: Claude Opus 4.8
    effort: HIGH
    condition: Alternativa sugerida e não bloqueante.
effective_selection:
  family: Claude
  model: Claude Opus 4.8
  effort: HIGH
  agent_workflow: Kiro Default
  mode: AUTOPILOT
  suggested_alternative_used: true
comparison_result: USER_SELECTED_ALTERNATIVE
```

A seleção efetiva é decisão do usuário no Kiro. A divergência é estado informativo
(`USER_SELECTED_ALTERNATIVE`), não bloqueante, sem finding, warning ou exigência de
justificativa. A seleção do `follow-up-01` está registrada na seção de follow-up.

## Preflight read-only (round-01)

Todas as verificações foram executadas em modo somente leitura, sem alterar as fontes canônicas
e sem executar operações da futura implementação.

### Bindings de entrada e integridade (round-01)

Os cinco artefatos canônicos foram confrontados com os hashes de entrada da rodada inicial;
todos coincidiram exatamente (`sha256sum`):

| Artefato | Hash em round-01 | Estado |
|---|---|---|
| `discovery.md` | `d9b40cdcab92dd01bea55918beff7ceb8e164a49b455471fa6a54f5d8ef0be77` | `MATCH` |
| `requirements.md` | `fe83db42aa19de992ceb90291d5db4caa69fcbf35e315e9d1fc1692ff4598aa2` | `MATCH` |
| `design.md` | `46532b9e7e43ff7626bbedc1e040dbf6af1e343502b99b5242d52e31146cd056` | `MATCH` |
| `tasks.md` | `d0db920216777dd6f373d991be5f996baa0fb0410724052434245fb64c7f24e7` | `MATCH` (superseded em follow-up-01) |
| `execution-brief.md` | `aabe902ea0c3ce8aca78d157e0cdb953350720ffb133e36d90f8e6a33aa6a7c7` | `MATCH` (superseded em follow-up-01) |

### Sessão autora, working state e writers (round-01)

- Sessão autora: `framework-governance-and-portability →
  sess_04e851e5-483e-4521-a586-ea3e096e5723` (workspace-root `e2df63d7933296c1`).
- Independência por papel e sessão satisfeita.
- Working state coerente com contract-review pré-execução; sem writer concorrente.

### Estado real confrontado (round-01)

- Módulos base existem (`adapters/distribution/installation.mjs`); design não cria segundo
  engine e é executável.
- `execution-selection.schema.yaml` ausente (correto: criado em `M1.1`).
- `OperationalRetentionPolicy.md` ausente e sem task explícita — origem do finding CR-002.
- Dependências `ajv/ajv-formats/yaml` pinadas conforme `AGENTS.md`; sem dependência nova.

## Confronto e verificações exigidas (round-01)

- **157 IDs** completos, sequenciais, sem lacunas/duplicatas
  (SEL 12, REP 9, ARC 10, REL 18, INS 14, LIF 20, PRJ 11, PLT 7, CICD 15, CLN 6, NFR 10,
  BR 7, ACC 18 = 157); sem contradição material.
- Rastreabilidade requirement→design→task→test→evidence presente (matriz exigida por ACC-016).
- Recomendação de LLM não bloqueante e autoridade do usuário preservadas.
- Provider-neutrality do core preservada; nomes concretos confinados a selection record/handoff.
- Separação de autorizações, writer único e checkpoints por operação sólidas.
- Ed25519, imutabilidade e supply-chain abrangentes.
- Archive restaurável antes de qualquer limpeza.
- `UNKNOWN/PARTIAL`, rollback, uninstall e retenção coerentes.
- Lifecycle global e `PROJECT_UPDATE` separados.
- Milestones M1–M15 ordenados, acíclicos e executáveis.
- Nenhuma dependência, claim ou operação não contratada.

## Ledger de findings

Todos os findings foram registrados como **não materiais** em round-01 e reconfrontados em
`follow-up-01`. Estado atual: **todos `RESOLVED`**. O rework tocou exclusivamente `tasks.md` e
`execution-brief.md`, sem mudança material e sem novo finding.

```yaml
- id: CR-001
  kind: FINDING
  severity: LOW
  materiality: NON_MATERIAL
  requirement: ACC-016
  expected: Rastreabilidade estável entre a numeração de milestones do discovery e da Spec.
  observed: >-
    Discovery numera M0–M13; Spec usa M1–M15 sem nota de mapeamento discovery-M# ↔ spec-M#.
  evidence:
    - .kiro/specs/framework-governance-and-portability/discovery.md#milestones-e-checkpoints
    - .kiro/specs/framework-governance-and-portability/tasks.md
    - .kiro/specs/framework-governance-and-portability/requirements.md#rastreabilidade-por-dominio
  impact: >-
    Cross-referência por número entre discovery e Spec ambígua em programa de alto risco.
  recommendation: >-
    Adicionar nota explícita de mapeamento discovery-M# ↔ spec-M#.
  resolution: >-
    tasks.md (3e18e3d2…) inclui a seção "Mapeamento de milestones: discovery → Spec" com tabela
    completa M0–M13 → M1–M15, declarando explicitamente que a renumeração não altera ordem,
    gates, decisões nem autorizações e que a tabela é somente de rastreabilidade, sem criar
    dependência adicional.
  state: RESOLVED

- id: CR-002
  kind: FINDING
  severity: LOW
  materiality: NON_MATERIAL
  requirement: BR-007
  expected: >-
    Toda fonte única de verdade nomeada no design possui task explícita de criação/propriedade.
  observed: >-
    Design nomeia policies/OperationalRetentionPolicy.md como fonte de retenção, sem task de
    criação; arquivo ausente no estado real.
  evidence:
    - .kiro/specs/framework-governance-and-portability/design.md#fonte-unica-de-verdade
    - .kiro/specs/framework-governance-and-portability/tasks.md
  impact: >-
    Fonte única de retenção poderia ser omitida, enfraquecendo BR-007/LIF-017.
  recommendation: >-
    Task explícita para autorar a policy e consumo sem duplicação normativa.
  resolution: >-
    tasks.md M2.7 cria policies/OperationalRetentionPolicy.md como fonte normativa única
    (receipts, journals, tombstones, backup original, 3 versões+90 dias, 30 dias pós-uninstall e
    holds de UNKNOWN/PARTIAL). M5.7 consome a policy "sem repetir valores"; os testes incluem
    source-of-truth scan que rejeita valores de retenção duplicados; Stop de M2/M5 bloqueia
    "valor de retenção fora da policy". Sem duplicação normativa.
  state: RESOLVED

- id: CR-003
  kind: FINDING
  severity: LOW
  materiality: NON_MATERIAL
  requirement: ACC-016
  expected: >-
    Cada requisito, inclusive transversais, é rastreável a design, task, teste e evidência.
  observed: >-
    NFR-010 e BR-002/004/006 apareciam apenas como "transversal → todos", sem linha por
    milestone.
  evidence:
    - .kiro/specs/framework-governance-and-portability/tasks.md
    - .kiro/specs/framework-governance-and-portability/requirements.md#rastreabilidade-por-dominio
  impact: >-
    Mapeamento apenas transversal dificultava provar cobertura por milestone (ACC-016).
  recommendation: >-
    Vincular explicitamente NFR-010 e BR-002/004/006 a task, teste e evidência concretas.
  resolution: >-
    tasks.md inclui a tabela "Rastreabilidade transversal obrigatória" ligando NFR-010
    (M2.2/M2.8, M5.1, gates M9.7/M15.2), BR-002 (M2.8, M8.8), BR-004 (M2.8, M5.3, M9.1,
    M15.1–M15.2) e BR-006 (M5.8 e fault injection M5) a testes e evidências específicas. M2.8
    deve falhar se qualquer ligação estiver ausente, e explicita que classificar apenas como
    "transversal" não satisfaz ACC-016. Requirements por milestone de M2/M5/M9/M15 passam a
    listar esses IDs.
  state: RESOLVED

- id: CR-004
  kind: WARNING
  severity: INFORMATIONAL
  materiality: NON_MATERIAL
  requirement: CLN-005
  expected: >-
    A ordem vinculante não sugere que a validação Windows (M14) precede a limpeza (M15).
  observed: >-
    Diagrama linear do execution-brief (M13→M14→M15) podia ser lido como M14 antes de M15.
  evidence:
    - .kiro/specs/framework-governance-and-portability/execution-brief.md#dependencias-e-ordem-vinculante
    - .kiro/specs/framework-governance-and-portability/tasks.md#matriz-compacta-de-dependencias-e-modos
  impact: >-
    Possível leitura equivocada de gating; sem conflito substantivo.
  recommendation: >-
    Anotar que M14 é milestone independente e não bloqueante para M15.
  resolution: >-
    execution-brief.md (a3a03811…) substitui o diagrama linear por ramificação a partir de M12
    (M13→M15 e M14 em paralelo) e declara que M14 depende de M7 e M12, é independente de M15 e
    que ausência de validação Windows não bloqueia M15 (dependência limitada a M3 restore PASS,
    M12 release verified, M13 Linux PASS e workspace preservation PASS), sem autorizar claim
    Windows. Coerente com a matriz de tasks.md (M14 depende 7,12; M15 depende 3,12,13).
  state: RESOLVED
```

## Decisão

**Status: `APPROVED`**

O contrato (requirements, design, tasks, execution brief), confrontado com discovery, workflow,
policies, contracts e estado real, é completo, internamente consistente, rastreável, seguro,
com autorizações e writers separados e milestones executáveis. Os quatro findings não materiais
foram resolvidos no rework, sem mudança material e sem novo finding. Os artefatos canônicos
tornam-se finais para efeito de contract-review e o execution brief é considerado executável.

O contrato está **apto a receber uma autorização separada de `execute-contract`**.

**A aprovação não autoriza implementação.** Nenhuma execução, archive, Git, GitHub, signing,
release, instalação global, `PROJECT_UPDATE`, rollback, uninstall, fresh install ou limpeza é
autorizada por este review. A transição `contract-review → execute-contract`
(`approved_and_execution_authorized`) requer autorização de execução separada e explícita do
usuário e uma sessão de engenharia autorizada.

## Follow-up-01

### Seleção efetiva registrada antes do preflight do follow-up

```yaml
selection_guidance:
  recommended:
    family: Claude
    model: Claude Opus 4.8
    effort: HIGH
    agent_workflow: Kiro Default
    mode: AUTOPILOT
  fallback_guidance:
    family: Claude
    model: Claude Opus 5
    effort: HIGH
    condition: Alternativa sugerida e não bloqueante.
effective_selection:
  family: Claude
  model: Claude Opus 4.8
  effort: HIGH
  agent_workflow: Kiro Default
  mode: AUTOPILOT
  suggested_alternative_used: false
comparison_result: MATCH
```

### Data

`2026-08-02` (contexto de sessão).

### Verificações do follow-up

1. **Seis hashes de entrada** — reconfirmados por `sha256sum`; todos `MATCH`
   (discovery `d9b40c…`, requirements `fe83db…`, design `465326…`, tasks `3e18e3…`,
   execution-brief `a3a038…`, contract-review anterior `6e5e7d…`).
2. **Continuidade da sessão revisora** — follow-up conduzido na sessão revisora original.
3. **Independência da sessão autora** — mantida distinta de `sess_04e851e5-…`.
4. **Sem writer concorrente** — raiz e `framework/` não são repositórios Git; nenhum lock/writer
   concorrente sobre os artefatos.
5. **157 IDs preservados** — `requirements.md` inalterado (hash idêntico); nenhum ID
   adicionado/removido; tasks.md apenas passou a referenciar IDs já existentes.
6. **M1–M15 e dependências materiais preservadas** — matriz de dependências inalterada
   (M14 depende 7,12; M15 depende 3,12,13); ordem e gates mantidos.
7. **Somente `tasks.md` e `execution-brief.md` mudaram** — confirmado pelos hashes; discovery,
   requirements e design permanecem idênticos.
8. **Nenhuma task executada** — 0 caixas marcadas e 115 pendentes; artefatos da futura
   implementação ausentes (`execution-selection.schema.yaml`, `OperationalRetentionPolicy.md`,
   `tools/cli.mjs`, `installers/`); `framework/` não é repositório Git.
9. **`npm run validate` permanece válido** — `status: VALID`, 12 checks, exit 0, executado
   somente contra o estado atual do framework (validação read-only, não task da implementação).
10. **Nenhum resultado de fixture interpretado como autorização** — o validador de transição
    emite `decision: CHAINED` em fixture sintética com hashes placeholder (`aaaa…`) e referência
    de autorização stub; esse resultado é um autoteste do validador e **não** concede autorização
    real. A autorização de execução permanece pendente de roteamento explícito do usuário.

### Reconfronto dos findings

`CR-001`, `CR-002`, `CR-003` e `CR-004` reconfrontados individualmente e alterados de `OPEN`
para `RESOLVED`, com evidência de correção registrada em cada entrada do ledger acima. Conclusão:
**nenhuma mudança material**; **nenhum novo finding** (material ou não material).

### Decisão do follow-up

Todos os findings resolvidos e nenhum novo finding material → status elevado para `APPROVED`.

## Limitações desta revisão

- Revisão estritamente read-only nas duas rodadas; nenhuma operação da futura implementação foi
  executada (sem build/signing/Git/GitHub/archive/release/instalação global/`PROJECT_UPDATE`/
  rollback/uninstall/limpeza).
- `npm run validate` foi executado apenas como verificação do estado atual do framework; não
  executa nem valida a implementação futura.
- Presença/ausência de arquivos verificada por listagem e manifest; interior dos módulos `.mjs`
  não auditado linha a linha.
- Versões de host citadas no discovery não foram reverificadas no host nesta sessão.
- Os cinco artefatos da Spec não foram alterados por este review.

## Próxima disposição

- Contract Review encerra em `APPROVED`. Não há findings abertos e o follow-up retornou à
  sessão revisora original conforme exigido.
- **Sem encadeamento automático** para `execute-contract`. A implementação depende de uma
  autorização de execução separada e explícita do usuário, em sessão de engenharia autorizada
  (`session_rules.engineering_*`), com preflight próprio que reconfirme allowlist física,
  bindings e estado real.
- Enquanto essa autorização não for concedida, nenhum efeito material está autorizado e o
  contrato permanece apenas apto — não em execução.
