# Validation — Layout global manifest-driven do framework v3 (segunda opinião)

## Identificação

- **Fase:** validate-delivery · **Tipo:** VALIDATION · **Modo operacional:** SECOND_OPINION
- **Papel:** DELIVERY_ASSURANCE
- **Projeto:** AgenticDevOps · **Slug:** framework-v3-global-bootstrap-layout · **Rodada:** round-02 (stage-b)
- **Operation ID sob análise:** `bootstrap-v3-20260802162347283-4c5efab1`
- **Agente executor:** Kiro · **Superfície/Host:** IDE / Linux (x86_64) · **Shell:** Bash
- **Família/Modelo resolvidos:** Cloud Opus / **Claude Opus 4.8** (efetivo no seletor; sem fallback; sem downgrade)
- **Esforço:** Max · **Agente/Workflow Kiro:** Default · **Modo:** Autopilot (somente inspeção read-only e testes temporários)
- **Overlay:** HighRiskOverlay proporcional — estado global aplicado, receipt pendente
- **Data:** 2026-08-02

## Sessão e independência

- **Sessão desta validação:** `delivery-assurance/framework-v3-global-bootstrap-layout/round-02-stage-b` (nova, independente).
- **Sessões NÃO retomadas:** `engineering-author/framework-v3`; `engineering-author/framework-v3/post-restart-stage-b`; `delivery-assurance/framework-v3-global-bootstrap-layout/round-01`.
- **Independência confirmada:** sim. Todo o estado relatado no handoff foi tratado como `REPORTED` até comprovação direta.
- **NÃO usados como autoridade:** conversa/racional das sessões anteriores, resumos, checkboxes, o handoff que exigia `NO_CHANGES`, e a decisão `PASSED_WITH_WARNINGS` de round-01. Cada afirmação foi reconfrontada contra fontes, gerados, pacote, arquivos globais, runtime nativo, código, contrato e documentação oficial.

## Aplicação da ExecutionEnvironmentPolicy

- Superfície IDE; host Linux x86_64; shell Bash; workspace `/home/villas/Projects/AgenticDevOps`.
- Raiz global Kiro: `/home/villas/.kiro` (`KIRO_GLOBAL_ROOT`). Estado operacional (backup/journal/receipt) fora de `~/.kiro`, em `/home/villas/.local/state/agentic-devops/backups/framework-v3/<operation-id>/`.
- Temporário próprio: `/tmp/pkg_inspect` (extração do pacote), removido ao final.
- Ações classificadas: **read-only** (leitura, hash, `tar -t`, grep de logs) e **local ephemeral** (extração de pacote em temporário próprio). Nenhuma escrita local exceto os dois artefatos autorizados desta rodada. Zero escrita global, zero Git, zero remoto.
- Exit codes e efeitos registrados. Nenhuma escrita stateful; nenhum retry de escrita incerta. Autonomia não concedeu autoridade.

## Preflight independente (confirmado diretamente)

| Item | Esperado | Observado | Verificação |
|---|---|---|---|
| Sessão independente nova | round-02-stage-b | round-02-stage-b | CONFIRMED_DIRECTLY |
| Modelo efetivo | Claude Opus 4.8 / Max | Claude Opus 4.8 (runtime atual) | CONFIRMED_DIRECTLY |
| Operation ID | bootstrap-v3-20260802162347283-4c5efab1 | idem no receipt/journal/backup | CONFIRMED_DIRECTLY |
| Raiz global / fonte | `~/.kiro` / `framework/**` | resolvidas | CONFIRMED_DIRECTLY |
| Manifest SHA-256 | `2be3970d…add38d` | `2be3970d…add38d` | CONFIRMED_DIRECTLY |
| Lock SHA-256 | `e603adf0…d0ac77` | `e603adf0…d0ac77` | CONFIRMED_DIRECTLY |
| Package SHA-256 | `434f1c09…988505` | `434f1c09…988505` | CONFIRMED_DIRECTLY |
| Self-update SHA-256 (`skills/workflow-bootstrap/SKILL.md`) | `38d95b69…8300a79` | `38d95b69…8300a79` | CONFIRMED_DIRECTLY |
| Receipt | PRE_RESTART_PENDING, inalterado | `status: PRE_RESTART_PENDING`, `pending_action: skill-bootstrap` | CONFIRMED_DIRECTLY |
| Backup | 19/19 disponível | 19 entradas `verified: true` (9 SKILL.md + 9 retirements + 1 self-update) | CONFIRMED_DIRECTLY |
| Escrita pós-Etapa B | nenhuma | receipt/journal em Etapa A (16:23–16:28); `post-restart-validation: NOT_EXECUTED` | CONFIRMED_DIRECTLY |
| Operação concorrente | nenhuma | writer único; nenhuma | CONFIRMED_DIRECTLY |
| Git | nenhum | sem `.git` na raiz → `NOT_APPLICABLE_NO_REPOSITORY` | CONFIRMED_DIRECTLY |

## Estado global real (aplicado)

Ao contrário de round-01 (que observou os 19 globais v2.3 intactos), o estado global **agora está com o layout v3 aplicado** por uma operação global separada:

- `~/.kiro/skills/` contém exatamente **10** diretórios v3 (`<slug>/SKILL.md` + `references/` com 1 arquivo cada).
- `~/.kiro/steering/` contém somente `agentic-workflow.md` (v3, `inclusion: always`) — **um único** `.md`. O diretório `steering/contracts/` permanece vazio (diretório compartilhado preservado após a retirada; não é defeito).
- `core/`, `policies/`, `contracts/`, `adapters/kiro/` v3 presentes.
- **Nove steering v2.3 ausentes** — confirmado path a path (`steering/workflow-core.md` + 8 `steering/contracts/*.md`).
- **Mixed authority ausente** — não há coexistência de autoridade normativa v2.3 e v3; o único steering é o entrypoint v3.

## Metodologia

1. Leitura direta do contrato final (requirements/design/tasks/execution-brief), do Contract Review round-01 e da evidência round-01 (execução + validação), tratados como referência, não como autoridade.
2. Inspeção das dez Skills nas **quatro superfícies** (fonte canônica, gerado, pacote, destino global) com bytes, SHA-256, frontmatter bruto, parse, encoding e line endings.
3. Confronto com a documentação oficial vigente do formato Agent Skills.
4. Evidência nativa do runtime Kiro: steering injetado no contexto, catálogo de Skills e logs sanitizados do loader.
5. Reconfronto do planner idempotente contra código e contrato.
6. Verificação do estado operacional (receipt/journal/backup) e do estado global real.

## Superfícies comparadas — dez Skills

Superfícies:
1. **Canônica** — `framework/skills/<slug>/SKILL.md` (classe `GLOBAL_KIRO_MANAGED`; origem do destino global).
2. **Gerada** — `framework/generated/skills/<slug>.md` (`GENERATED_PACKAGE_CONTENT`; = comentário de proveniência + canônica; sem destino global).
3. **Pacote** — `package/skills/<slug>/SKILL.md` dentro de `agentic-devops-framework-v3-3.0.0.tgz`.
4. **Global** — `~/.kiro/skills/<slug>/SKILL.md` (aplicada).

**Identidade por SHA-256:** para cada slug, **canônica = pacote = global** (byte a byte). A gerada difere apenas pelo cabeçalho de proveniência (`<!-- GENERATED FROM … -->`), mantendo o mesmo frontmatter. O instalador **não mutou** conteúdo.

| Slug | Papel | Canônica bytes / SHA-256(16) | Global == Canônica | Pacote == Canônica | `description` (4 superfícies) |
|---|---|---|---|---|---|
| workflow-bootstrap | ENGINEERING | 2825 / `38d95b69f29dda8e` | SIM | SIM | **ABSENT** |
| low-level-discovery | ENGINEERING | 1134 / `67aa7f32908f6328` | SIM | SIM | **ABSENT** |
| quick-spec | ENGINEERING | 1051 / `93e981d02081fc3a` | SIM | SIM | **ABSENT** |
| spec | ENGINEERING | 1037 / `699369e63b3bb28e` | SIM | SIM | **ABSENT** |
| bug-fix | ENGINEERING | 1013 / `fa2e8a1e1273e79e` | SIM | SIM | **ABSENT** |
| contract-review | CONTRACT_ASSURANCE | 1122 / `b6239e613bd60f1e` | SIM | SIM | **ABSENT** |
| execute-contract | ENGINEERING | 1205 / `daa3a634c82ab4a9` | SIM | SIM | **ABSENT** |
| validate-delivery | DELIVERY_ASSURANCE | 1132 / `017c84ac7bc0b089` | SIM | SIM | **ABSENT** |
| correct-from-validation | ENGINEERING | 1101 / `a04476699402867b` | SIM | SIM | **ABSENT** |
| delivery-closeout | ENGINEERING | 1153 / `0b46ce9883e175a9` | SIM | SIM | **ABSENT** |

## Frontmatter das dez Skills (metadados, sem corpo normativo)

Frontmatter observado, idêntico em estrutura nas quatro superfícies (exemplo representativo):

```
---
name: <slug>
version: 3.0.0
role: <ENGINEERING|CONTRACT_ASSURANCE|DELIVERY_ASSURANCE>
phase: <slug>
references:
  <chave>: references/<arquivo>.md
---
```

- **`name`:** presente nas 10; **igual ao diretório** (verificado 10/10).
- **`version`:** `3.0.0` nas 10.
- **`role` / `phase`:** presentes nas 10.
- **`references`:** presente nas 10 (1 chave conditional cada; arquivo existente).
- **`description`:** **AUSENTE nas 10, em todas as 4 superfícies** (`grep '^description:'` = 0 em cada arquivo).
- **Encoding:** ASCII/UTF-8; **sem BOM** (primeiros bytes `2d 2d 2d` = `---`); **line endings LF**; sem caractere de controle anômalo.
- **Slug/pasta:** válidos (minúsculas + hífen), alinhados a `name`.
- **Nenhum outro defeito** de frontmatter, nome, slug, encoding ou estrutura foi encontrado. O único desvio é a ausência de `description`.

Nota: `version`, `role`, `phase`, `references` são campos adicionais próprios do framework (progressive disclosure), permitidos como metadados extra; não são o bloqueio e são preservados.

## Autoridade oficial — formato Agent Skills

A documentação vigente do formato Agent Skills (SKILL.md) determina que o frontmatter YAML exige **exatamente dois campos obrigatórios: `name` e `description`**; os demais são opcionais. A `description` é o campo que os agentes usam para **descobrir** e decidir a relevância de uma Skill (capacidade + gatilho de uso), e `name` deve coincidir com o diretório. Skill sem os campos obrigatórios é inválida e pode não aparecer no catálogo nem nos slash commands.

Fontes consultadas (metadados; conteúdo parafraseado para conformidade de licenciamento): referência de frontmatter `shalomb/agent-skills` (`docs/reference/yaml-frontmatter.md`); atlan.com (Required Fields and Loading Levels); skywork.ai (Claude skills format); agentman.ai (SKILL.md anatomy). Conteúdo foi reformulado para conformidade com restrições de licenciamento.

**Confronto:** as 10 Skills possuem `name` válido, mas **não possuem `description`** → não conformes ao formato oficial.

## Runtime do Kiro (evidência nativa)

- **Steering carregado (independente das Skills):** o entrypoint `~/.kiro/steering/agentic-workflow.md` (v3, `inclusion: always`) está **injetado no contexto desta sessão** (regra `agentic-workflow`), byte a byte igual ao arquivo instalado. Os logs do loader (`~/.kiro/logs/20260802T164523780/kiro.log`) mostram `[Steering] ExistingFiles` resolvendo `core/WorkflowRouter.md`, `skills/workflow-bootstrap/SKILL.md`, `skills/workflow-bootstrap/references/migration.md`, `policies/ExecutionEnvironmentPolicy.md`, `policies/HighRiskOverlay.md`, `core/workflow.yaml`. **O loader do steering funciona e a instalação é legível.**
- **Skills não descobertas:** o catálogo/runtime de Skills exibe **`Available Items: None`**. `Available Items: None` refere-se especificamente às Skills (o steering `always` é injetado, não listado como ativável). As **dez** Skills estão ausentes do catálogo.
- **Diagnóstico do loader (causa direta):** o mesmo log registra, pós-restart (16:45:25–26), um WARN por Skill:
  `[NodeProgressiveContextSource] SKILL.md missing name or description: /home/villas/.kiro/skills/<slug>/SKILL.md`
  para **as dez** Skills (em duas passagens de carga). Como `name` está comprovadamente presente e alinhado ao diretório, o campo ausente que dispara a rejeição é **`description`**.
- **Invocação direta (`/workflow-bootstrap` ou equivalente):** não reconhecível como Skill enquanto o item não é registrado no catálogo (skills rejeitadas na carga).
- **Cache/novo restart:** não há evidência de que outro restart resolva. O restart já ocorreu; a rejeição é determinística por conteúdo (frontmatter sem `description`), não por cache. Reprocessar sem corrigir o frontmatter reproduz o mesmo WARN.

## Causa

- **Origem:** **fonte canônica incorreta**. As dez `framework/skills/<slug>/SKILL.md` foram autoradas sem o campo obrigatório `description`.
- **Propagação fiel (sem mutação):** o gerador (`tools/lib/skills.mjs` → `renderGeneratedSkill`) apenas antepõe um comentário de proveniência; o pacote inclui a canônica byte a byte; o instalador copiou a canônica byte a byte ao global. Gerador, pacote e instalador **não** introduziram nem removeram o campo — apenas propagaram a ausência de origem.
- **Ponto cego do framework:** `validateSkillText` (em `tools/lib/skills.mjs`) verifica `name`, `version`, `role`, `phase`, `references` e sete seções, **mas nunca verifica `description`**; `parseSkillFrontmatter` também não a exige. Por isso `npm run validate`, `npm test` e a validação round-01 passaram sem detectar o desvio: o validador local não modela o requisito oficial de `description`.
- **Não é parsing/runtime:** o campo está genuinamente ausente dos bytes em todas as superfícies; não é artefato de parser.

## Planner / idempotência

Reconfronto contra código (`framework/tools/lib/distribution.mjs`, `dry-run.mjs`, `installation.mjs`) e contrato:

- **Decisão do planner:** `distribution.mjs` computa `decision = blockedActions.length > 0 ? 'BLOCKED' : 'CHECKPOINT_REQUIRED'`. **Não existe** caminho de decisão de topo `NO_CHANGES`. Qualquer operação global não bloqueada resulta em `CHECKPOINT_REQUIRED`, **inclusive um dry-run totalmente idempotente** (64 itens `IDENTICAL → NO_CHANGE`).
- **Dry-run gate:** `classifyDryRun` recebe `environment: SHARED`, `operation_class: PERMISSION_SECURITY`, `risk: HIGH`, `external_effect: true` → `dry_run_decision` também `CHECKPOINT_REQUIRED` por desenho (operação sobre raiz global compartilhada é sempre checkpoint-gated).
- **Contrato:** REQ-006 (critério de aceite) determina explicitamente “Operação global é classificada como `CHECKPOINT_REQUIRED`”. `installation.mjs` exige `plan.decision === 'CHECKPOINT_REQUIRED'` para autorizar.
- **NFR-002:** idempotência = “nova execução deve observar 64 `NO_CHANGE`, zero backup novo, zero self-update, zero alteração de timestamp/metadado e zero mutação”. O resultado relatado (INSTALL 0 / UPDATE 0 / NO_CHANGE 64 / CONFLICT 0 / BLOCKED 0 / retirements pendentes 0 / self-update pendente 0 / mutações 0) **satisfaz NFR-002 integralmente**.

**Determinações formais:**
1. `CHECKPOINT_REQUIRED` **é a decisão correta** para qualquer operação global, inclusive dry-run idempotente. Confirmado por contrato (REQ-006) **e** por código (`distribution.mjs:491`).
2. Os 64 `NO_CHANGE` e zero mutações **satisfazem NFR-002**.
3. **Não existe finding no planner.** O comportamento é conforme.
4. A exigência anterior de um resultado de topo `NO_CHANGES` era **incompatível com o contrato final e com o código** — nenhuma decisão `NO_CHANGES` existe no planner de instalação. **Esse era um falso blocker e não deve reaparecer.**

## Findings

### VAL-GBL-001 — Global Skills missing required `description` metadata

- **Classificação:** MATERIAL, corrigível.
- **Estado:** CONFIRMED_DIRECTLY nas quatro superfícies e no runtime nativo.
- **Causa exata:** fonte canônica incorreta (dez `SKILL.md` sem `description`); gerador/pacote/instalador propagaram fielmente; validador local com ponto cego (não exige `description`).
- **Evidência:** `grep '^description:'` = 0 nas 40 leituras (10 slugs × 4 superfícies); WARN do loader para as 10; catálogo `Available Items: None`; documentação oficial exige `description`.
- **Impactos mínimos:**
  - Skills inválidas/indiscoveráveis perante o formato oficial;
  - catálogo/runtime não comprova as dez Skills (comprovadamente vazio);
  - Etapa B **não concluível** (REQ-014 exige “dez Skills carregáveis”);
  - receipt **não pode ser finalizado**;
  - instalação global **não pode ser declarada `GLOBAL_UPDATED`**.

Sem outros findings de frontmatter, nome, slug, encoding ou estrutura. O “blocker” do planner (`CHECKPOINT_REQUIRED`) é **falso** e foi refutado acima.

## Correction-spec

Criada, delimitada e **não autorizada a executar**:
`.kiro/specs/framework-v3-global-bootstrap-layout/corrections/round-02/correction-spec.md` — status `NEEDS_USER_DECISION`.

Escopo previsto (somente correção local): restaurar `description` válida nas 10 Skills preservando `name`/slugs/conteúdo/progressive disclosure; adicionar gate no validador + teste exigindo `description` não vazia nas 10 e teste de catálogo/metadata compatível com o formato oficial; regenerar outputs; atualizar lock e pacote; preservar mapa 64, cinco classes, nove retirements e arquitetura; reexecutar validators/testes; retornar para revalidação independente. **Sem** alteração global, nova Etapa A, restart, Etapa B, receipt, piloto, rollback, Git ou remoto.

## Estado do receipt

- **Atual:** `PRE_RESTART_PENDING`, `pending_action: skill-bootstrap`, inalterado por esta rodada.
- **Determinação (Q6):** o receipt **deve permanecer pendente**. A Etapa B não pode comprovar “dez Skills carregáveis” (REQ-014) enquanto as Skills não forem descobertas; portanto o self-update não é reconciliado e o receipt não é finalizado. **Não** deve ser forçado a `GLOBAL_UPDATED`. A finalização só é admissível após correção local, regeneração/repacote, e um **novo ciclo global (nova Etapa A) + restart + Etapa B** — operação separada e futura.

## Estado global

- Layout v3 aplicado (64 managed items fisicamente presentes; as 10 `SKILL.md` global = canônica byte a byte).
- Nove steering v2.3 ausentes; mixed authority ausente; steering entrypoint carregado.
- Skills **não descobertas** (bloqueio efetivo da Etapa B).
- Backup 19/19 verificável; journal `APPLIED` (seq 1–72 VERIFIED; seq 73 self-update `BACKED_UP`, reconciliação deferida à Etapa B).

## Riscos

- Alterar `description` muda o conteúdo das 10 `SKILL.md` → muda o hash do self-update (`workflow-bootstrap`) e, por encadeamento, gerados, lock, manifest e pacote. Uma **nova operação global** (nova Etapa A/restart/Etapa B) será necessária; a operação atual não pode ser “completada” sobre o pacote atual.
- Enquanto não corrigido, o Kiro não expõe as Skills; o roteamento por steering funciona, mas a invocação/descoberta de Skills não.
- Risco de reincidência do falso blocker `CHECKPOINT_REQUIRED`: mitigado por registro explícito acima.
- O ponto cego do validador precisa de gate/teste, sob pena de o defeito reincidir em futuras gerações.

## Operações NÃO executadas (por contrato e por limite desta rodada)

Zero correção; zero escrita global; zero alteração em `framework/**`, package, lock, manifest, receipt, journal, backup, contrato, tasks e evidência anterior; nenhuma nova Etapa A; nenhum restart; nenhuma Etapa B; nenhum piloto; nenhum rollback; **zero Git**; **zero operação remota**. Escrita desta rodada: somente este `VALIDATION.md` e a `correction-spec.md` acima. Temporário `/tmp/pkg_inspect` removido.

## Decisão

```
FAILED
```

Existe finding material corrigível confirmado (VAL-GBL-001). O estado foi integralmente avaliável (não `BLOCKED`). As Skills são inválidas e não descobertas, logo não cabe `PASSED_WITH_WARNINGS`; e o receipt pendente impede `PASSED`.

## Próxima fase e sessão

- **Próxima fase candidata:** `correct-from-validation` (após decisão do usuário sobre a correction-spec).
- **Sessão futura da correção:** retomar `engineering-author/framework-v3`.
- **Correção ainda não autorizada.**
- **Preservar** esta sessão round-02 (`delivery-assurance/framework-v3-global-bootstrap-layout/round-02-stage-b`) para revalidação independente após a correção local.
- A correção global (nova Etapa A + restart + Etapa B) é operação **separada e posterior**, com preflight, plano, snapshot, backup, modo Supervised e autorização próprios.

## Status

```
FAILED
```
