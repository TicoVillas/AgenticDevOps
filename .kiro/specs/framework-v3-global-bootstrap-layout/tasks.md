# Tasks — Layout global manifest-driven do framework v3

Status: FINAL  
Fase: spec  
Projeto: AgenticDevOps  
Slug: framework-v3-global-bootstrap-layout  
Estratégia: Design-First  
Linha de sessão: engenharia e autoria  
Sessão: engineering-author/framework-v3  
Origem: `requirements.md` e `design.md` em `DRAFT`  
Última atualização: 2026-07-28

## Regras de execução das tasks

- Estas tasks são implementáveis somente após Contract Review aprovado, artefatos `FINAL`, `execution-brief.md = FINAL_READY_FOR_EXECUTION` e autorização explícita de implementação.
- Toda escrita da execução futura fica limitada a `framework/**`, testes correspondentes e `evidence/execution/round-N/**` deste slug.
- Testes de filesystem usam roots temporárias sintéticas e nunca `/home/villas/.kiro`, `~/.kiro` ou outra raiz global real.
- Etapa A global, retirada dos nove steering, self-update real, restart, Etapa B real, piloto `PROJECT_UPDATE`, rollback real, Git e remoto **não são tasks desta implementação**.
- Nenhuma task pode adicionar dependência sem `REQUIRES_REPLANNING`.
- `Kiro_v2_3_source/**`, `Kiro_v2_4_source/**`, `Analise_Workflow_v3.0.md` e `.kiro/specs/framework-v3/**` permanecem read-only.

## Visão dos grupos

| Grupo | Tasks | Resultado |
|---|---|---|
| A — Contratos, inventário e steering | 1–3 | distribuição declarativa exata e entrypoint determinístico |
| B — Validator, estados e planner | 4–6 | validação completa e dry-run read-only fail-closed |
| C — Transação, recuperação e bootstrap | 7–10 | mecanismos operacionais exercitáveis apenas em roots sintéticas |
| D — Integração, regressão e evidência | 11–12 | cobertura, lock/pacote reconciliados e entrega local verificável |

# Grupo A — Contratos, inventário e steering

## Tarefa 1 — Definir os contratos de distribuição e evidência operacional

**Requisitos:** REQ-002, REQ-003, REQ-007, REQ-010, SEC-003, SEC-006, SEC-007, NFR-001, NFR-003.  
**Design:** Contrato do distribution manifest; Artefatos operacionais derivados.  
**Dependências:** nenhuma.  
**Áreas:** `framework/contracts/schemas/**`, `framework/contracts/templates/**` quando aplicável.

**Resultado:** schemas tool-neutral e exemplos mínimos descrevem manifest, backup manifest, journal e installation receipt sem instalar esses artefatos no global.

- [x] 1.1 Criar `distribution-manifest.schema.yaml` com envelope, catálogo, managed items, retirements, fases, loader roles, metadados e invariantes estruturais.
- [x] 1.2 Criar schemas operacionais estritamente necessários para documentos persistentes independentes, preservando separação entre intenção e execução.
- [-] 1.3 Criar templates/exemplos mínimos somente quando exigidos por validação, classificados como `SOURCE_ONLY`.
- [x] 1.4 Integrar os novos schemas ao validador de contracts existente sem duplicar regras semânticas do manifest.
- [x] 1.5 Adicionar testes de schema positivos e negativos, incluindo enums fechados, hashes, paths, IDs e estados.

**Validação:** testes direcionados de contracts; schema inválido deve falhar sem filesystem material.  
**Checkpoint:** se os documentos operacionais puderem usar um schema existente sem perda de semântica, parar e submeter simplificação ao reviewer; não criar abstração redundante.

## Tarefa 2 — Materializar o catálogo e o mapa Kiro exato de 64 itens

**Requisitos:** REQ-001, REQ-002, REQ-003, REQ-011, REQ-012, REQ-017, REQ-018, SEC-007, COMP-001.  
**Design:** Interpretação vinculante; Mapa completo dos 64 itens; legacy retirements.  
**Dependências:** Tarefa 1.  
**Áreas:** `framework/adapters/kiro/distribution-manifest.yaml`, `framework/policies/ownership.yaml` somente se necessário ao ownership existente.

**Resultado:** manifest adapter-specific classifica todas as fontes locked e declara exatamente o mapa vinculante 64/64, nove retirements e a ordem topológica.

- [x] 2.1 Catalogar toda fonte protegida por `framework.lock` em uma das cinco classes canônicas.
- [x] 2.2 Declarar os 64 managed items conforme a tabela vinculante, com IDs, source IDs, destinations, loader roles e dependências.
- [x] 2.3 Fixar owner/group/mode simbólicos, diretórios `0755`, arquivos `0644` e semântica `NOT_APPLICABLE` quando o host não oferecer POSIX.
- [x] 2.4 Declarar exatamente nove legacy retirements com baseline hash, backup obrigatório e `remove_only_if_exact`.
- [x] 2.5 Marcar apenas `skills/workflow-bootstrap/SKILL.md` como self-update e garantir posição final.
- [x] 2.6 Provar que adapters ChatGPT/Codex/Claude e novos artefatos SOURCE_ONLY/BUILD_TEST_ONLY não possuem destino global.

**Validação:** contagem 5+10+25+20+3+1=64; destinations e IDs únicos; nove retirements; cross-check integral com a tabela de `design.md`.  
**Checkpoint:** qualquer necessidade de 65º destino ou remapeamento exige `REQUIRES_REPLANNING`.

## Tarefa 3 — Gerar o steering global fino e determinístico

**Requisitos:** REQ-004, REQ-005, REQ-018, SEC-003, SEC-007, NFR-001, COMP-001.  
**Design:** Geração determinística do steering.  
**Dependências:** Tarefas 1–2.  
**Áreas:** `framework/adapters/kiro/templates/agentic-workflow.md`, `framework/adapters/kiro/generated/agentic-workflow.md`, geradores já existentes quando reutilizáveis.

**Resultado:** `agentic-workflow.md` reproduzível, always-included, adapter-specific e sem segunda autoridade normativa.

- [x] 3.1 Criar o template SOURCE_ONLY e definir inputs/provenance explícitos.
- [x] 3.2 Implementar geração determinística sem timestamp, host, segredo ou path absoluto.
- [x] 3.3 Emitir front matter `inclusion: always`, referência ao core/router e orientação mínima de seleção de Skill.
- [x] 3.4 Adicionar teste anti-duplicação de workflow, políticas, contratos e Skills completos.
- [x] 3.5 Verificar referências no layout staged sintético e hash idêntico em duas gerações.

**Validação:** testes de adapter/gerador; comparação byte a byte; uma newline final; provenance verificável.  
**Checkpoint:** se o loader exigir conteúdo normativo duplicado ou mecanismo não aprovado, usar `REQUIRES_REPLANNING`.

# Grupo B — Validator, estados e planner

## Tarefa 4 — Implementar validação estrutural e semântica da distribuição

**Requisitos:** REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-007, REQ-011, REQ-012, REQ-017, REQ-018, SEC-001, SEC-003, SEC-007.  
**Design:** Validator do manifest.  
**Dependências:** Tarefas 1–3.  
**Áreas:** `framework/tools/lib/distribution.mjs`, `framework/tools/validate-distribution.mjs`, `framework/tools/validate-all.mjs`.

**Resultado:** validator read-only rejeita qualquer desvio estrutural ou semântico entre catálogo, mapa, generated content, lock e pacote.

- [x] 4.1 Implementar parsing e validação de schema com Ajv/YAML já pinados.
- [x] 4.2 Implementar completude do catálogo contra `framework.lock` e rejeição de fonte unlocked/ausente/hash-divergente.
- [x] 4.3 Implementar as invariantes de 64 items, nove retirements, um entrypoint, um self-update final e DAG acíclico.
- [x] 4.4 Implementar normalização, containment sintético, colisão case-fold e rejeição de source/destination inválidos.
- [x] 4.5 Implementar reconciliação de generated output e metadados do pacote sem executar empacotamento durante o validator.
- [x] 4.6 Integrar o comando em `npm run validate`.

**Validação:** matriz negativa para missing/extra/duplicate/path/class/adapter/hash/order/cycle; zero mutação observada.  
**Checkpoint:** nenhum warning pode substituir falha material do mapa ou da integridade.

## Tarefa 5 — Implementar snapshot e classificador de estados

**Requisitos:** REQ-006, REQ-008, REQ-009, REQ-012, REQ-016, SEC-001, SEC-002, SEC-004, SEC-009, NFR-001, NFR-002, NFR-003.  
**Design:** Estados de destino; Planner read-only.  
**Dependências:** Tarefa 4.  
**Áreas:** `framework/tools/lib/distribution.mjs`, abstrações de filesystem locais, fixtures sintéticas.

**Resultado:** snapshot e classificador observam roots injetadas sem seguir symlink nem alterar arquivos e produzem todos os estados canônicos.

- [x] 5.1 Implementar snapshot por `lstat`, containment, hash, tipo, mode e UID/GID quando suportados.
- [x] 5.2 Calcular snapshot hash agregado sem usar timestamps como identidade.
- [x] 5.3 Implementar os 13 estados canônicos e provenance gerenciada por receipt/baseline conhecido.
- [x] 5.4 Preservar unmanaged e bloquear symlink, tipo inesperado, escape, legacy modificado e estado parcial desconhecido.
- [x] 5.5 Exercitar semântica Linux e Windows por roots/paths sintéticos e adapters de filesystem.

**Validação:** fixtures por estado; source/destination/ancestral symlink; path traversal; arquivos extras; ausência total de mutação.  
**Checkpoint:** classificação ambígua deve resultar em `UNKNOWN_PARTIAL`/`BLOCKED`, nunca em update inferido.

## Tarefa 6 — Implementar planner read-only e integração com dry-run

**Requisitos:** REQ-006, REQ-008, REQ-009, REQ-011, REQ-012, REQ-013, REQ-016, OPS-002, SEC-009, NFR-001, NFR-002.  
**Design:** Planner read-only; Etapa A; Critérios de interrupção.  
**Dependências:** Tarefas 4–5.  
**Áreas:** `framework/tools/lib/distribution.mjs`, `framework/tools/lib/dry-run.mjs`, CLI read-only.

**Resultado:** plano determinístico por item declara `NO_CHANGE`, criação/update condicionado, retirements, backup set, self-update, checkpoints e bloqueios, sem executar ações.

- [x] 6.1 Ordenar ações pela DAG e por ID estável, mantendo self-update por último.
- [x] 6.2 Vincular plano a snapshot, manifest/lock/package hashes e autorização esperada.
- [x] 6.3 Reutilizar `classifyDryRun` para marcar operação global como `CHECKPOINT_REQUIRED`.
- [x] 6.4 Incluir predicted effects, backup esperado, rollback preview, stop criteria e operações explicitamente não autorizadas.
- [x] 6.5 Produzir decisão global `BLOCKED` diante de qualquer item materialmente não controlado.
- [x] 6.6 Provar segunda execução sintética com 64 `NO_CHANGE` e zero ação mutável.

**Validação:** comparação de snapshots antes/depois do planner; planos determinísticos; casos bloqueantes; idempotência.  
**Checkpoint:** planner não recebe capacidade de apply ou escrita indireta.

# Grupo C — Transação, recuperação e bootstrap

## Tarefa 7 — Implementar modelos de backup, journal e receipt em roots injetadas

**Requisitos:** REQ-010, REQ-013, REQ-014, REQ-015, REQ-016, SEC-003, SEC-005, SEC-006, SEC-009.  
**Design:** Artefatos operacionais derivados; Falha parcial.  
**Dependências:** Tarefas 1 e 5–6.  
**Áreas:** `framework/tools/lib/installation.mjs`, schemas/templates da Tarefa 1, testes sintéticos.

**Resultado:** componentes locais produzem backup manifest, WAL/journal e receipt coerentes, sanitizados e verificáveis sem alcançar a raiz global real.

- [x] 7.1 Implementar operation ID, paths externos injetados e correlação com snapshot/plano.
- [x] 7.2 Implementar cópia e verificação de backup antes da mutação sintética correspondente.
- [x] 7.3 Implementar transições válidas de journal com intent anterior e verificação posterior.
- [x] 7.4 Implementar receipt que separa planned, executed, verified, pending, failed e unknown.
- [x] 7.5 Impedir que o receipt pré-restart registre self-update como concluído.
- [x] 7.6 Sanitizar evidência e bloquear backup inconsistente/incompleto.

**Validação:** corrupção/ausência de backup; transição inválida; receipt falso; nenhuma escrita fora das roots temporárias autorizadas.  
**Checkpoint:** path real `~/.kiro` ou backup root não injetado bloqueia testes e execução local.

## Tarefa 8 — Implementar aplicação transacional somente para roots sintéticas

**Requisitos:** REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, SEC-001, SEC-002, SEC-004, SEC-005, SEC-008, SEC-009, OPS-001.  
**Design:** Etapa A; Boundaries.  
**Dependências:** Tarefas 6–7.  
**Áreas:** `framework/tools/lib/installation.mjs`, fixtures temporárias.

**Resultado:** executor testável aplica o plano em root explicitamente injetada, verifica cada etapa e bloqueia qualquer tentativa de usar a raiz global real durante a implementação.

- [x] 8.1 Implementar staging e substituição atômica compatível com a plataforma nas roots sintéticas.
- [x] 8.2 Revalidar snapshot e autorização simulada antes de cada classe de mutação.
- [x] 8.3 Aplicar suporte, adapter, referências, Skills e entrypoint na ordem contratada.
- [x] 8.4 Retirar apenas os nove legados baseline-exact após backup e entrypoint verificado.
- [x] 8.5 Preservar arquivo extra/unmanaged e diretório compartilhado.
- [x] 8.6 Injetar falhas antes/depois de cada escrita e registrar estado conhecido.

**Validação:** clean install/update/legacy migration em temp dirs; falhas injetadas; metadados; zero acesso a `/home/villas/.kiro`.  
**Checkpoint:** esta task não cria CLI operacional apontável à raiz global sem gate explícito do contrato final.

## Tarefa 9 — Implementar resume e rollback limitados

**Requisitos:** REQ-015, REQ-016, SEC-004, SEC-005, SEC-009, NFR-002, OPS-002.  
**Design:** Falha parcial e retomada segura; Rollback.  
**Dependências:** Tarefas 7–8.  
**Áreas:** `framework/tools/lib/installation.mjs`, testes de fault injection.

**Resultado:** resume só continua estado conhecido e rollback só restaura paths atribuídos, ambos exercitados em roots sintéticas.

- [x] 9.1 Reconciliar filesystem, source, backup, journal e receipt antes de resume.
- [x] 9.2 Bloquear `UNKNOWN`, timeout incerto, snapshot divergente e autorização expirada.
- [x] 9.3 Derivar rollback por operation ID e comparar after-hash antes de restaurar.
- [x] 9.4 Restaurar bytes e metadados; remover criado somente sob regra `pre-state=ABSENT`.
- [x] 9.5 Restaurar legados apenas dos backups exatos e preservar unmanaged/diretórios compartilhados.
- [x] 9.6 Produzir receipt sintético próprio de rollback sem executar rollback real.

**Validação:** resume conhecido, unknown bloqueado, after-hash divergente, rollback completo e preservação de extras.  
**Checkpoint:** rollback real permanece fora do escopo e exige autorização separada.

## Tarefa 10 — Adaptar workflow-bootstrap e modelar a validação pós-restart

**Requisitos:** REQ-013, REQ-014, REQ-017, COMP-001, OPS-001, OPS-002, SEC-006, SEC-009.  
**Design:** Etapa A; Etapa B; Idempotência.  
**Dependências:** Tarefas 3–9.  
**Áreas:** `framework/skills/workflow-bootstrap/SKILL.md`, `framework/skills/workflow-bootstrap/references/migration.md`, tooling local relacionado.

**Resultado:** a Skill consome o manifest/plano, não mantém mapa paralelo, modela self-update final/hard stop e define Etapa B como nova execução, sem operar o global nesta task.

- [x] 10.1 Substituir inferência procedural por contrato de consumo do planner validado.
- [x] 10.2 Formalizar preflight, checkpoint, ações proibidas e critérios de interrupção.
- [x] 10.3 Implementar/testar controle que torna a própria `SKILL.md` última escrita e retorna `RESTART_REQUIRED`.
- [x] 10.4 Garantir hard stop sem escrita posterior na execução pré-restart.
- [x] 10.5 Definir o comando/fluxo read-only da futura Etapa B: reconciliação, 64/64, loader, mixed authority, idempotência e receipt final.
- [x] 10.6 Manter piloto `PROJECT_UPDATE`, adapters não Kiro, restart e operação real como transições não executadas.

**Validação:** testes de ordem e hard stop em temp roots; teste que detecta escrita posterior; nenhum restart ou global real.  
**Checkpoint:** se a atualização da Skill não puder ser isolada como última escrita, usar `REQUIRES_REPLANNING`.

# Grupo D — Integração, regressão e evidência

## Tarefa 11 — Completar matriz de testes e regressões

**Requisitos:** todos, com foco em REQ-007, REQ-008, REQ-014, REQ-015, REQ-016, REQ-018, SEC-001–SEC-009, NFR-001–NFR-003.  
**Design:** Estratégia de testes; Segurança.  
**Dependências:** Tarefas 1–10.  
**Áreas:** `framework/tests/distribution/**`, testes existentes diretamente afetados.

**Resultado:** suíte prova contratos, estados, segurança, transação, recuperação, compatibilidade e idempotência sem tocar ambiente real.

- [x] 11.1 Cobrir manifest válido e todas as mutações estruturais/semânticas relevantes.
- [x] 11.2 Cobrir source/destination/ancestral symlink, traversal, escape, case-fold, tipo, permissões e unmanaged.
- [x] 11.3 Cobrir todos os estados canônicos e nove legados idênticos/modificados/ausentes.
- [x] 11.4 Cobrir falha antes/depois de cada classe de write, receipt fiel, resume, rollback e hard stop.
- [x] 11.5 Cobrir geração determinística, progressive loading documental e layout staged.
- [x] 11.6 Reexecutar regressões de contracts, adapters, compatibility, skills, dry-run e source-lock.
- [x] 11.7 Confirmar que testes não criam/modificam `/home/villas/.kiro/**`.

**Validação:** `npm test` e testes direcionados a partir de `framework/`; exit code 0; efeitos temporários limpos.  
**Checkpoint:** runtime Kiro pós-restart é `NOT_EXECUTED` nesta entrega, não simulado como prova real.

## Tarefa 12 — Reconciliar geração, lock, pacote, validação ampla e evidência

**Requisitos:** REQ-001–REQ-018, SEC-003, SEC-006, SEC-007, NFR-001, OPS-001, OPS-002.  
**Design:** Compatibilidade e preservações; Checkpoints CP-01/CP-02.  
**Dependências:** Tarefas 1–11.  
**Áreas:** generated outputs, `framework/framework.lock`, package metadata/lockfile somente se necessário, `evidence/execution/round-N/EXECUTION.md`.

**Resultado:** árvore local validada, lock e pacote reconciliados, diff revisado e evidência factual pronta para validação independente.

- [x] 12.1 Regenerar somente outputs determinísticos autorizados e revisar o delta.
- [x] 12.2 Atualizar `framework.lock` pelo comando oficial após todos os novos arquivos estabilizarem.
- [x] 12.3 Executar `npm run validate` e `npm test` no Node 24.x; sem runtime adequado, registrar `NEEDS_STATE_VALIDATION` sem instalar Node.
- [x] 12.4 Gerar o pacote pelo comando oficial autorizado, inspecionar conteúdo e confirmar reconciliação package/lock/manifest/payload.
- [x] 12.5 Confirmar mapa 64, nove retirements, ausência de destinos não Kiro e ausência de arquivos desbloqueados.
- [x] 12.6 Revisar diff/paths, preservações, segredos, ruído, generated files e lockfile.
- [x] 12.7 Criar `EXECUTION.md` com comandos, exit codes, resultados, limitações, runtime global `NOT_EXECUTED` e seleção da validação independente.

**Validação:** comandos oficiais aprovados; pacote inspecionado; lock sem drift; apenas paths autorizados alterados.  
**Checkpoint:** não executar Git, instalação global, restart, piloto, release ou deploy.

## Operações futuras explicitamente não representadas como tasks

As operações abaixo exigem fases, artefatos, checkpoints e autorizações próprias após implementação e validação independente local:

1. Etapa A sobre `/home/villas/.kiro/**`;
2. backup real e retirada dos nove steering v2.3;
3. self-update global real;
4. restart do Kiro;
5. Etapa B pós-restart;
6. piloto `AgenticDevOps` em `PROJECT_UPDATE`;
7. rollback real;
8. staging, commit, push, PR, merge, release ou deploy.

## Rastreabilidade resumida

| Requisitos | Tasks |
|---|---|
| REQ-001–REQ-005 | 1–4 |
| REQ-006–REQ-008 | 4–6, 11 |
| REQ-009–REQ-014 | 6–8, 10–12 |
| REQ-015–REQ-016 | 7–9, 11 |
| REQ-017–REQ-018 | 2–4, 10–12 |
| SEC-001–SEC-009 | 1, 4–9, 11–12 |
| NFR-001–NFR-003 | 1, 3–6, 11–12 |
| COMP-001 | 2–3, 10–12 |
| OPS-001–OPS-002 | todas; especialmente 6–12 |

## Ordem de execução

```text
1 → 2 → 3
        ↓
        4 → 5 → 6
                ↓
                7 → 8 → 9 → 10
                                ↓
                                11 → 12
```

Não há paralelismo de escrita planejado. Um escritor por working tree permanece obrigatório.
