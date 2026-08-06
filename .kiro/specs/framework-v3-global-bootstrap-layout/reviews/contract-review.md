# Contract Review — Layout global manifest-driven do framework v3

## Identificação

- **Fase:** contract-review
- **Modo operacional:** INITIAL_REVIEW
- **Papel:** CONTRACT_ASSURANCE
- **Projeto:** AgenticDevOps
- **Slug:** framework-v3-global-bootstrap-layout
- **Tipo de Spec:** Spec completa
- **Estratégia:** Design-First
- **Assurance:** HIGH_RISK (proporcional ao impacto da futura instalação global)
- **Overlay:** HighRiskOverlay aplicado à operação global futura, não à construção local
- **Agente executor:** Kiro · **Superfície/Host:** IDE / Linux (x86_64)
- **Agente/Workflow Kiro:** Default · **Modo:** Autopilot
- **Família/Modelo resolvidos:** Cloud Opus / Claude Opus 4.8 (confirmado no seletor real; sem fallback)
- **Esforço:** Max
- **Rodada:** round-01
- **Última atualização:** 2026-08-02

## Sessão e independência

- **Sessão autora (não usada como autoridade):** `engineering-author/framework-v3`.
- **Sessão revisora:** `contract-assurance/framework-v3-global-bootstrap-layout/round-01` (nova, independente).
- **Independência confirmada:** sim.
- **Contexto recebido:** instrução de review, raiz da Spec, cinco artefatos canônicos, contratos aplicáveis, risco/overlay, estado real do repositório e da instalação global.
- **Contexto NÃO usado como autoridade:** conversa/racional da autoria, resumos de sessão, alegações de “revisão cruzada aprovada”, memória do slug anterior `framework-v3`. O slug `framework-v3` foi tratado apenas como evidência histórica de escopo.

## Artefatos revisados

| Artefato | Estado esperado | Observado | Verificação |
|---|---|---|---|
| `discovery.md` | APPROVED_FOR_SPEC | APPROVED_FOR_SPEC | CONFIRMED_DIRECTLY |
| `design.md` | DRAFT | DRAFT | CONFIRMED_DIRECTLY |
| `requirements.md` | DRAFT | DRAFT | CONFIRMED_DIRECTLY |
| `tasks.md` | DRAFT | DRAFT | CONFIRMED_DIRECTLY |
| `execution-brief.md` | DRAFT_READY_FOR_CONTRACT_REVIEW | DRAFT_READY_FOR_CONTRACT_REVIEW | CONFIRMED_DIRECTLY |
| `reviews/contract-review.md` | inexistente | criado nesta rodada | — |

## Estado real (preflight independente)

- **Raiz:** `/home/villas/Projects/AgenticDevOps` confirmada; **sem `.git` na raiz** (não inicializado). CONFIRMED_DIRECTLY.
- **Writer único:** apenas esta sessão revisora escreve, restrita aos paths autorizados.
- **Execução desta Spec:** ausente — sem `evidence/`, sem `framework/manifest`, sem `distribution-manifest.yaml`. CONFIRMED_DIRECTLY.
- **`framework.lock`:** 143 entradas; **143/143 verificadas por SHA-256** (0 ausentes, 0 divergentes). Único arquivo não-locked na árvore (excl. `node_modules`/`.tgz`) é o próprio `framework.lock` — **sem drift, sem arquivo não autorizado**. CONFIRMED_DIRECTLY.
- **Integridade de `framework/`:** íntegra; nenhuma alteração desta rodada.
- **`~/.kiro/**` preservado:** `~/.kiro/steering` e `~/.kiro/skills` presentes; **19 arquivos globais v2.3** confirmados — 9 steering (`workflow-core.md` + 8 contratos) + 10 Skills — idênticos ao inventário do discovery e à lista de 9 `legacy_retirements` do design. Nenhuma escrita global executada.
- **Git/instalação/backup/remoção/restart:** nenhum executado.

## Contratos aplicados

ContextPolicy, ArtifactContract, EvidenceAndFeedbackContract, ExecutionEnvironmentPolicy, GitSafetyPolicy, SecureDevelopmentPolicy, ModelSelectionPolicy e HighRiskOverlay (proporcional). Referenciados, não reproduzidos.

## Resumo do contrato

A Spec define, em modalidade Design-First, um mecanismo **manifest-driven** para futura instalação global do adapter Kiro:

- `distribution-manifest.yaml` (adapter Kiro) + schema tool-neutral, com dois eixos separados: `source_catalog` (todas as 143 fontes locked, classificadas em cinco classes) e `managed_items` (exatamente 64 destinos globais);
- mapa vinculante **64/64** (5 core + 10 policies + 25 contracts + 20 Skills + 3 adapter Kiro + 1 steering gerado);
- steering `~/.kiro/steering/agentic-workflow.md` gerado, fino, `inclusion: always`, sem segunda autoridade normativa;
- planner read-only, 13 estados de destino fail-closed, e módulo transacional (snapshot, backup externo, journal/WAL, receipt, apply atômico, resume, rollback) exercitável **somente em roots sintéticas**;
- self-update de `workflow-bootstrap/SKILL.md` como última escrita da Etapa A, `RESTART_REQUIRED`, e Etapa B pós-restart separada (prova 64/64, loader, ausência de mixed authority, idempotência);
- limites explícitos que mantêm instalação, retirada dos 9 steering v2.3, restart, piloto, Git e remoto **fora** desta entrega.

O contrato é **completo, internamente consistente, seguro, testável e executável**, com separação local×global rigorosa e riscos residuais declarados com honestidade. Identifiquei **um item não material** que corrigi diretamente e **um warning aceito**; nenhum finding material, nenhuma decisão material aberta.

## Ledger de findings

| ID | Classificação | Artefato/Seção | Finding | Estado | Evidência/Correção | Decisão |
|---|---|---|---|---|---|---|
| CR-GBL-001 | Não material (aplicado pelo reviewer) | `design.md` §`source_catalog` (invariantes) | O invariante “`sha256` deve igualar `framework.lock[path]`” aplicado a **toda** fonte locked incluía implicitamente o próprio manifest, criando tensão com a propriedade exigida no discovery (“sem hash recursivo impraticável”): um manifest não pode embutir o próprio hash recursivamente. | RESOLVED | Adicionado invariante derivado esclarecendo que a integridade do manifest é registrada exclusivamente pelo `framework.lock` externo, sem auto-hash recursivo, e que hashes de conteúdo gerado são calculados na ordem gerar → lock → pacote. Não altera comportamento, mapa 64, taxonomia, segurança ou decisões do discovery. | Fechado |
| CR-GBL-002 | Warning (ACCEPTED) | `design.md`/`requirements.md` (inventário 64; REQ-004/REQ-007) | A inclusão dos 25 contracts como `GLOBAL_KIRO_MANAGED` (em especial 16 schemas + 7 templates) é decisão alinhada e defensável, mas o contrato não demonstra explicitamente a resolução de referência Skills/steering → schemas/templates no layout global; o tooling que consome schemas é `SOURCE_ONLY` e não é instalado. | ACCEPTED_WARNING | O contrato já exige resolução de referências no layout staged (REQ-004) e na Etapa B, e reconciliação package/lock/manifest (REQ-007/REQ-018). Recomenda-se, sem bloquear, um teste explícito de “zero referência pendente / zero órfão” cobrindo os 25 contracts. | Preservar/execução |

## Rodada atual — round-01 (INITIAL_REVIEW)

### Objetivo

Revisar independentemente se o contrato define de forma completa, segura, testável e executável a **implementação local** do mecanismo manifest-driven para a futura instalação global do adapter Kiro, sem incorporar a operação global.

### Revisão obrigatória — resultados

**Mapa vinculante 64/64.** Confirmado internamente: 5 (core, itens 1–5) + 10 (policies, 6–15) + 25 (contracts, 16–40: 2 documentos + 16 schemas + 7 templates) + 20 (Skills, 41–60: 10 `SKILL.md` + 10 referências) + 3 (adapter Kiro, 61–63) + 1 (steering, 64) = **64**. Destinos únicos; 63 preexistentes + 1 gerado novo. Consistente entre discovery, design (tabela vinculante), requirements (REQ-001) e execution-brief.

**Catálogo e taxonomia.** Cinco classes (`GLOBAL_KIRO_MANAGED`, `SOURCE_ONLY`, `PROJECT_TEMPLATE`, `GENERATED_PACKAGE_CONTENT`, `BUILD_TEST_ONLY`); `source_catalog` (todas as 143 locked) e `managed_items` (64) separados; `LEGACY_ACTIVE_CONFLICT` corretamente tratado como **estado de destino**, não sexta classe. Coerente.

**Steering global.** `inclusion: always`, fino, adapter-specific, `generated_from`/provenance, determinístico (sem timestamp/host/path absoluto), sem duplicar workflow/políticas/contratos, sem reutilizar nomes legados, `loader_role: STEERING_ENTRYPOINT`. Referências exigidas resolvíveis no layout staged (REQ-004) e reprovadas na Etapa B. A prova definitiva do loader real é honestamente diferida à Etapa B (risco residual declarado).

**Manifest e schemas.** Envelope versionado; campos globais e por item completos; DAG por `apply_phase`/`depends_on`; **exatamente 9 retirements** (batem byte a byte com os 9 steering v2.3 reais) e **exatamente 1 self-update** (item 60, `workflow-bootstrap/SKILL.md`). Dependência cíclica rejeitada pelo validator. A única lacuna — recursão de hash do próprio manifest — foi corrigida (CR-GBL-001).

**Estados e planner.** 13 estados objetivos; planner estritamente read-only (sem escrita/temporário/chmod/chown/remoção; raízes/fs/clock injetáveis); `IDENTICAL → NO_CHANGE`; `MANAGED_DIVERGENT`/`LEGACY_MODIFIED`/`UNMANAGED_PRESENT`/symlink/tipo/escape/source-mismatch/`UNKNOWN_PARTIAL` bloqueiam; operação global sempre `CHECKPOINT_REQUIRED`. Coerente.

**Transação.** Staging fora da superfície ativa, snapshot vinculado à autorização, backup externo verificável antes da 1ª mutação, journal/WAL com estados, receipt fiel (só ações verificadas), substituição atômica, falha parcial classificada, resume só `KNOWN_RECOVERABLE`, rollback derivado de backup/journal. Completo.

**Self-update.** `workflow-bootstrap/SKILL.md` é a última escrita da Etapa A; após confirmação, nenhuma escrita de arquivo/journal/receipt/evidência; `RESTART_REQUIRED` em stdout/status (não é escrita de arquivo); Etapa B não inicia automaticamente. A compatibilidade entre “sem escrita após self-update” e journal/receipt é resolvida: intent do self-update é registrado antes; a conclusão é reconciliada na Etapa B. Consistente.

**Etapa B.** Nova execução após restart real, com identidade (operation ID) e inputs suficientes (journal + receipt externos + estado real + manifest); reconcilia self-update; prova 64/64, loader e dez Skills, ausência dos nove steering e de mixed authority, idempotência (`NO_CHANGE`), finaliza receipt. Suficiente.

**Segurança.** SEC-001–009 cobrem containment/realpath+lstat/no-follow, traversal, symlink ancestral, preservação de unmanaged, backup antes de mutação, ausência de remoção por glob, sem elevação de privilégio, sem dependência nova. Tabela de riscos com testes negativos por ameaça. Proporcional e não inflada.

**Limite local × global.** Implementação e testes **somente em roots sintéticas**; guarda explícita que rejeita `/home/villas/.kiro`, `$HOME/.kiro` e a raiz global resolvida (execution-brief §Segurança; Task 8 checkpoint; Task 11.7); Etapa A real, restart, Etapa B, piloto e rollback real explicitamente **fora das tasks** (OPS-001/002, seção de operações não representadas). Nenhuma autorização operacional inferida.

**Portabilidade.** Linux e Windows via abstração de filesystem e roots/paths sintéticos; UID/GID/mode `NOT_APPLICABLE` quando o host não oferece POSIX, **sem fingir equivalência**; atomicidade/paths tratados por plataforma. Risco residual (atomicidade/ACL real de Windows só comprovável em Windows) declarado honestamente.

**Rastreabilidade.** REQ-001–018, SEC-001–009, NFR-001–003, COMP-001, OPS-001–002 mapeados a design e às Tarefas 1–12 (matriz em `tasks.md`), com testes e evidência esperada. Cada requisito possui critério de aceite verificável. Sem requisito órfão.

**Preservações.** Core tool-neutral (paths/semântica Kiro no adapter/manifest); lifecycle de `DiscoveryRouter.md` (item 63, GPC, não é steering nem um dos 9 legados); comandos oficiais `npm run validate`/`npm test`; pacote reproduzível; sem mudança em v2.3/v2.4 nem `Analise_Workflow_v3.0.md`; adapters ChatGPT/Codex/Claude fora do lote global Kiro. Confirmado.

### Questões de contestação prioritária — determinações

1. **Instalar os 25 contracts é necessário/coerente?** Defensável e alinhado: os dois documentos de contrato são referências normativas das Skills; schemas/templates completam o domínio `contracts/` e mantêm as referências resolvíveis no global. A coerência **já é contratada** para validação (REQ-004 staged + Etapa B loader + REQ-007/REQ-018 reconciliação). Registrado como **warning não bloqueante** (CR-GBL-002) recomendando um teste explícito anti-órfão. **Não** é motivo de rework.
2. **Steering mínimo é suficiente para localizar core/router sem carregamento transitivo não documentado?** Sim, com a ressalva já contratada: o steering carrega referências válidas e instrui o Kiro Default a resolver core/router e Skill; o discovery reconhece que links markdown isolados não provam carregamento e exige prova de resolução no staged e no runtime da Etapa B. Risco residual declarado. Aceitável para Design-First local.
3. **Manifest cataloga a si próprio sem circularidade?** Havia tensão (CR-GBL-001), **resolvida**: integridade do manifest pelo `framework.lock` externo, sem auto-hash recursivo; gerados hasheados antes do lock.
4. **Lock e pacote reconciliáveis deterministicamente após manifest/gerados?** Sim: ordem gerar → lock → pacote (design + Task 12.2/12.4); validator reconcilia manifest/lock/generated/pacote (Task 4.5). Reforçado por CR-GBL-001.
5. **Módulo transacional sem CLI operacional perigosa apontável à raiz real?** Sim: roots injetadas, guarda explícita contra raiz global, e Task 8 proíbe criar CLI apontável ao global sem gate do contrato final.
6. **Proibição de escrita pós-self-update compatível com journal/receipt/stdout/evidência?** Sim: intents/receipt registrados antes; conclusão reconciliada na Etapa B; `RESTART_REQUIRED` é stdout, não escrita de arquivo.
7. **Etapa B tem identidade e inputs suficientes para reconciliar a Etapa A?** Sim: operation ID + journal/receipt externos + estado real + manifest.
8. **Prova de Windows proporcional e executável sem alegação simulada?** Sim para semântica de path/containment via plataforma injetada; atomicidade/ACL real permanece risco residual declarado, não simulado como prova.
9. **12 tasks pequenas, ordenadas e completas para execução sequencial?** Sim: ordem linear 1→12 com dependências declaradas, subtasks verificáveis, validação e checkpoint por task; cobre contratos → catálogo/mapa → steering → validator → estados → planner → backup/journal/receipt → apply → resume/rollback → bootstrap/Etapa B → testes → reconciliação.

### Segurança

Cadeia risco → requisito → design → task → teste presente e proporcional; nenhuma segurança desproporcional; nenhum controle público/remoto/produção exigido indevidamente para construção local. Fronteiras não confiáveis (destino, filesystem, saída de ferramenta) tratadas com fail-closed. Sanitização de evidência (SEC-006). Sem segredos nos artefatos.

### HighRiskOverlay (proporcional)

Fontes read-only; path containment; supply chain limitada às três dependências autorizadas (`ajv`, `ajv-formats`, `yaml`); hashes/lock; rollback pelo descarte do delta paralelo (implementação) e por backup/journal (operação futura), sem depender de Git; falha parcial; observabilidade; critérios de interrupção; ausência de operação global/real. Overlay corretamente direcionado à Etapa A/B futura, não à construção local.

### Executabilidade

Node major 24 confirmado disponível (v24.18.0) + npm 11.16.0; `NEEDS_STATE_VALIDATION` definido como fail-closed. Baseline íntegra (143/143). Tasks executáveis fim-a-fim em roots sintéticas sem tocar o global. Sem dependência nova. Sem ambiguidade de runtime.

### Correções não materiais aplicadas

- **CR-GBL-001** aplicado em `design.md` (invariante adicional em `source_catalog`, derivado das próprias afirmações do design sobre proteção externa pelo lock). Não altera comportamento, mapa 64, taxonomia, segurança, rollback, self-update, Etapas, escopo, dependências, loader ou decisões do discovery.

### Mudanças materiais recusadas

Nenhuma. Nenhuma alteração de arquitetura, mapa, taxonomia ou decisão do discovery foi introduzida.

### Warnings

- **CR-GBL-002 (ACCEPTED):** recomendar teste explícito anti-órfão/anti-referência-pendente cobrindo os 25 contracts no layout global (não bloqueante; coerência já contratada).
- Prova definitiva do loader Kiro e da atomicidade/ACL real de Windows permanecem verificáveis apenas em runtime (Etapa B / host Windows) — riscos residuais já declarados.

### Pendências

Nenhuma material. Nomes finais de schemas/templates operacionais podem ser refinados na execução sem alterar IDs, comportamento, mapa 64, boundaries, segurança ou limites de autorização.

## Decisão vigente

```
APPROVED_WITH_NON_MATERIAL_FIXES
```

Contrato completo, coerente, seguro, testável e executável; um item não material corrigido pelo reviewer (CR-GBL-001) e um warning aceito (CR-GBL-002); nenhum finding material; nenhuma decisão material aberta. Consolidado como FINAL.

## Consolidação dos artefatos

```
discovery.md         = APPROVED_FOR_SPEC (inalterado)
requirements.md      = FINAL
design.md            = FINAL (com correção não material CR-GBL-001)
tasks.md             = FINAL
execution-brief.md   = FINAL_READY_FOR_EXECUTION
```

**Consolidar o contrato não autoriza implementar.** A execução local exige autorização explícita e separada do usuário. Operação global (Etapa A), restart, Etapa B, piloto, rollback real, Git e remoto permanecem fases futuras com autorização própria.

## Seleção recomendada para execução

Aplicada `ModelSelectionPolicy.md`; seleção do reviewer (não meramente herdada).

```
Próxima fase: execute-contract
Skill: `execute-contract`
Executor: Kiro · Superfície/Host: IDE / Linux
Família/Modelo: ENGINEERING — Codex / GPT-5.6 Sol (recomendação não bloqueante)
Esforço: High
Capacidade mínima: refatoração multi-arquivo longa, tool use determinístico, aderência estrita ao contrato e aos limites local×global
Agente/Workflow Kiro: Default
Modo: Autopilot para lotes locais determinísticos em roots sintéticas; Supervised se surgir checkpoint humano
Estratégia de sessão: Retomar a sessão de engenharia
Sessão de destino: `engineering-author/framework-v3`
Overlay: HighRiskOverlay proporcional (aplica-se à futura operação global; execução local é aditiva/sintética)
Fallback: Cloud Opus / Claude Opus 4.8 / High, apenas se selecionado explicitamente; sem downgrade silencioso
Preflight obrigatório: Node major 24 + npm (senão `NEEDS_STATE_VALIDATION`); writer único; guarda ativa contra `~/.kiro` real; roots sintéticas.
```

## Autorização da execução

```
Contrato pronto para execução: sim
Implementação local autorizada: não — requer autorização explícita e separada do usuário
Operação global / restart / Etapa B / piloto / Git / remoto: não — fases futuras com autorização própria
```

## Estratégia de sessão posterior

- **Execução local (quando autorizada):** retomar `engineering-author/framework-v3` (fase `execute-contract`).
- **Rework (se surgir):** retornar a `engineering-author/framework-v3`, com follow-up **nesta mesma** sessão revisora `contract-assurance/framework-v3-global-bootstrap-layout/round-01`.
- **Validação inicial (posterior):** nova sessão independente de `DELIVERY_ASSURANCE`.

## Histórico resumido

- **round-01 (2026-08-02) — INITIAL_REVIEW:** revisão independente completa. Preflight confirmou baseline íntegra (143/143), 19 v2.3 globais e 9 retirements coincidentes com o estado real, sem execução/Git/escrita global. Contrato aprovado com 1 correção não material (CR-GBL-001, aplicada) e 1 warning aceito (CR-GBL-002). Artefatos consolidados como FINAL / FINAL_READY_FOR_EXECUTION. Implementação não autorizada.

## Status

```
APPROVED_WITH_NON_MATERIAL_FIXES
```
