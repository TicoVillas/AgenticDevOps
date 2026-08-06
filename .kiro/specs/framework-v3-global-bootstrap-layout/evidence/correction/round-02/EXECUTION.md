# Correction Execution — VAL-GBL-001

## Identificação

- **Fase/modo:** `correct-from-validation` / `EXECUTE_CORRECTION`
- **Sessão autora:** `engineering-author/framework-v3`
- **Sessão validadora preservada:** `delivery-assurance/framework-v3-global-bootstrap-layout/round-02-stage-b`
- **Modelo:** GPT-5.6 Sol / High
- **Projeto:** `/home/villas/Projects/AgenticDevOps`
- **Finding autorizado:** `VAL-GBL-001 — Global Skills missing required description metadata`
- **Resultado do finding:** `ADDRESSED`
- **Status da execução:** `COMPLETED_WITH_WARNINGS`
- **Git:** `NOT_APPLICABLE_NO_REPOSITORY`

## Autoridade e transição

A autoridade de origem é `evidence/validation/round-02/VALIDATION.md`, com status `FAILED` e somente o finding `VAL-GBL-001`. A correction-spec é `corrections/round-02/correction-spec.md`; seu único campo de status foi transicionado de `NEEDS_USER_DECISION` para `READY_FOR_CORRECTION` após a autorização explícita atual. Nenhum outro finding foi incluído. O estado `CHECKPOINT_REQUIRED` do planner e o warning de `DiscoveryRouter.md` permanecem fora do escopo e inalterados.

Esta execução não declara o finding como `RESOLVED`: resolução pertence exclusivamente à sessão validadora. A prova de descoberta no catálogo/runtime Kiro permanece `NOT_EXECUTED`.

## Causa confirmada

As dez Skills canônicas não possuíam `description`; o gerador propagava a canônica sem mutação; `validateSkillText` não validava esse campo. Antes da correção, casos com campo ausente, `null`, número, string vazia, somente whitespace e acima de 1024 caracteres eram aceitos indevidamente.

A correção mínima adicionou somente uma linha `description` após `name` em cada Skill canônica. Removida essa linha, cada arquivo volta exatamente ao hash inicial correspondente, comprovando preservação dos bodies, do progressive disclosure e dos demais metadados. O gerador não foi alterado.

## Descriptions por superfície local

| Skill | Description canônica | Canônica | Gerada | Pacote |
|---|---|---:|---:|---:|
| `workflow-bootstrap` | Validates and coordinates framework bootstrap prerequisites, installation stages, restart reconciliation, and migration when global or project workflow state is absent, stale, or conflicting. | válida | idêntica | idêntica |
| `low-level-discovery` | Investigates repository reality against an approved high-level brief when engineering discovery is required before specification. | válida | idêntica | idêntica |
| `quick-spec` | Produces proportional requirements, design, tasks, and execution guidance when an approved change is clear, bounded, and low to moderate risk. | válida | idêntica | idêntica |
| `spec` | Produces a full traced specification with validation and rollback planning when work is complex, architectural, transversal, or high risk. | válida | idêntica | idêntica |
| `bug-fix` | Defines a cause-based minimal defect correction contract when a reproducible bug can be bounded without adding new behavior. | válida | idêntica | idêntica |
| `contract-review` | Independently reviews a draft engineering contract or its follow-up when approval, findings, and executability must be established. | válida | idêntica | idêntica |
| `execute-contract` | Implements an independently approved contract with progressive testing and evidence when explicit execution authorization is current. | válida | idêntica | idêntica |
| `validate-delivery` | Independently validates an implementation or revalidates authorized corrections when delivery claims must be proven against real evidence. | válida | idêntica | idêntica |
| `correct-from-validation` | Applies the smallest authorized correction for explicit validation findings when a ready correction specification exists. | válida | idêntica | idêntica |
| `delivery-closeout` | Executes only named closeout operations after accepted technical closure when separate local or remote closeout authorization is current. | válida | idêntica | idêntica |

As dez canônicas e as dez geradas usam UTF-8 sem BOM e LF. Todas possuem `name` igual ao diretório, `description` string não vazia e comprimento entre 121 e 191 caracteres. As dez Skills empacotadas são byte a byte idênticas às canônicas.

## Validador e testes

`framework/tools/lib/skills.mjs` passou a aplicar estes resultados sem enfraquecer os gates existentes:

- campo ausente: `description is required`;
- `null` ou tipo diferente de string: `description must be a string`;
- vazio ou somente whitespace: `description must not be empty`;
- mais de 1024 caracteres: `description must be at most 1024 characters`;
- 1024 caracteres: aceito.

`framework/tests/skills/skills.test.mjs` cobre as dez Skills, `name == directory`, description válida, limite 1024, ausência, `null`, tipo inválido, vazio, whitespace, oversized, metadata gerada loader-compatible, equivalência canônica/gerada, determinismo e preservação do progressive disclosure, sem simular descoberta pelo runtime Kiro.

Hashes finais:

- validador: `43c7d10d6b4b8ab01803c79695d0a2ae022568e817fe6872534dd5295236af38`;
- testes: `84464a54b4f34855b611c3a47af37c2000aedcd8a943912aa90b540524583249`.

## Hashes das Skills canônicas

| Skill | SHA-256 inicial | SHA-256 corrigido |
|---|---|---|
| `workflow-bootstrap` | `38d95b69f29dda8e0afa0f9768a3d235c94002fce29fbf14e3cb42a0b8300a79` | `caede0f0f52ac0a71a65f1e3861424aaf9bd6a0832692e701e6e3dc4594a6d73` |
| `low-level-discovery` | `67aa7f32908f63282014b6c228d16b29bf2bd8449149a3b2b8994c9d6e5b2a5a` | `401de17d0f03146befb77f891e8520d83e453cc582586c85b0c2ab05a4e06c4d` |
| `quick-spec` | `93e981d02081fc3a418fcebb6712e68f51f623dc469d3f56114c73fe3edcc43c` | `dfdeaf97bf70b1149d737315be387ca4a554516f9ad780eb7f61a2dd4237b095` |
| `spec` | `699369e63b3bb28ee60756239c757a41aae3d43d849dda21353f186066cfbdf6` | `33785021836bfd8005635c8458fc8b6befca47b35b4faa59a7db09c21c1cd9aa` |
| `bug-fix` | `fa2e8a1e1273e79eb26130728df2bd72bba40eb70579bba405749c4e8ca376fd` | `343b59f0bb2d4c4f98d59161e55da54e56b44567829c2799b07ea1ae962f9150` |
| `contract-review` | `b6239e613bd60f1e67134ca6803ae9448c85d7d66dc1d72f59c5db59a010b256` | `eef8eb79fe6e0b0fd42f686aa90faca9c0ea4e09f2e2a8ee4bf997ba08095120` |
| `execute-contract` | `daa3a634c82ab4a9d1d7383ea3b434cfd4ce449d44bf31bd075b2e5b5c6e48d6` | `2cdef0b9bbdb68a9b2c58177bf8b926f3e3bd386cbe6bd653e22df48d4d270` |
| `validate-delivery` | `017c84ac7bc0b0895a002258b8c022a18e1fbf574c7bf9b54719bb0f6aa4fde1` | `ee87519ec405acb831eaa279e8a0c3618f5389f4ce36668ce4d231b9da19b8e9` |
| `correct-from-validation` | `a04476699402867bfdb42d49a643f58d59fafad5b7cc86c8e3eb79cb15689558` | `6017d1808b024aaf92c312b2a0810cd814a053e48ee46994890b1f921ce94281` |
| `delivery-closeout` | `0b46ce9883e175a93b8cc44098e5dd5e3b1666b0fdfc5baed9226546b806ea33` | `af19db8e3f32fb57882f356537593a952a821b1503805b2079ebaf66cb208512` |

## Arquivos e superfícies alterados

Foram alterados 27 artefatos locais, contando esta evidência:

1. `framework/skills/workflow-bootstrap/SKILL.md`
2. `framework/skills/low-level-discovery/SKILL.md`
3. `framework/skills/quick-spec/SKILL.md`
4. `framework/skills/spec/SKILL.md`
5. `framework/skills/bug-fix/SKILL.md`
6. `framework/skills/contract-review/SKILL.md`
7. `framework/skills/execute-contract/SKILL.md`
8. `framework/skills/validate-delivery/SKILL.md`
9. `framework/skills/correct-from-validation/SKILL.md`
10. `framework/skills/delivery-closeout/SKILL.md`
11. `framework/generated/skills/workflow-bootstrap.md`
12. `framework/generated/skills/low-level-discovery.md`
13. `framework/generated/skills/quick-spec.md`
14. `framework/generated/skills/spec.md`
15. `framework/generated/skills/bug-fix.md`
16. `framework/generated/skills/contract-review.md`
17. `framework/generated/skills/execute-contract.md`
18. `framework/generated/skills/validate-delivery.md`
19. `framework/generated/skills/correct-from-validation.md`
20. `framework/generated/skills/delivery-closeout.md`
21. `framework/tools/lib/skills.mjs`
22. `framework/tests/skills/skills.test.mjs`
23. `framework/adapters/kiro/distribution-manifest.yaml`
24. `framework/framework.lock`
25. `framework/agentic-devops-framework-v3-3.0.0.tgz`
26. `.kiro/specs/framework-v3-global-bootstrap-layout/corrections/round-02/correction-spec.md`
27. `.kiro/specs/framework-v3-global-bootstrap-layout/evidence/correction/round-02/EXECUTION.md`

As árvores `Kiro_v2_3_source/`, `Kiro_v2_4_source/` e `Analise_Workflow_v3.0.md` permaneceram fora da escrita.

## Manifest, lock, mapa e pacote

Hashes vinculantes:

| Artefato | SHA-256 inicial | SHA-256 final |
|---|---|---|
| manifest | `2be3970d9dd6416fd001c17abbdb4b72988f0d6e3c441d90ae3e4aa090add38d` | `66f937537843d55b8ea18be4cb69d1418442928eba97a8ad917f7e8e028bd48c` |
| lock | `e603adf02a05763af69ed6310f0ea32c013b323be6da5d1d9863cea7c0d0ac77` | `b681969ccbb68cb3c784d78d1e745f6036e14755b9e684436716c33ab2f8d83b` |
| pacote | `434f1c09e6fa68fd1ce8bd2661541c2f2b7fef84e58317753514532e79988505` | `d01e4c89ec081018eec5671b0ad725a1561e8c842b4e51042583c88ae068dca8` |
| self-update source | `38d95b69f29dda8e0afa0f9768a3d235c94002fce29fbf14e3cb42a0b8300a79` | `caede0f0f52ac0a71a65f1e3861424aaf9bd6a0832692e701e6e3dc4594a6d73` |
| self-update global | `38d95b69f29dda8e0afa0f9768a3d235c94002fce29fbf14e3cb42a0b8300a79` | `38d95b69f29dda8e0afa0f9768a3d235c94002fce29fbf14e3cb42a0b8300a79` |

O manifest foi reconciliado somente nos 22 hashes derivados: dez canônicas, dez geradas, validador e teste. IDs, classes, destinos, modes, grupos, planner e retirements não mudaram. O inventário final preserva:

- 164 source entries;
- classes `SOURCE_ONLY: 57`, `GLOBAL_KIRO_MANAGED: 62`, `GENERATED_PACKAGE_CONTENT: 15`, `PROJECT_TEMPLATE: 2`, `BUILD_TEST_ONLY: 28`;
- 64 managed items, em grupos `5/10/25/20/3/1`;
- 9 retirements;
- 1 entrypoint;
- self-update único `skill-bootstrap`;
- planner `CHECKPOINT_REQUIRED`;
- dependências exatas inalteradas: `ajv 8.20.0`, `ajv-formats 3.0.1`, `yaml 2.9.0`.

O pacote contém 136 entries. Manifest e lock empacotados são byte a byte idênticos aos locais; as dez Skills empacotadas possuem metadata válida e são byte a byte idênticas às canônicas.

## Validações executadas

Todos os comandos abaixo terminaram com exit code `0`, salvo o incidente não material explicitamente registrado em Warnings.

| Comando/prova | Resultado |
|---|---|
| reprodução negativa anterior à correção | 6 formas inválidas aceitas, confirmando a causa |
| `node --test --test-name-pattern='^(description accepts|description rejects)' tests/skills/skills.test.mjs` | 2/2 testes passaram |
| `node --test tests/skills/skills.test.mjs` | 7/7 testes passaram |
| `node tools/generate-skills.mjs` | 10 outputs oficiais regenerados |
| inspeção canônica/gerada | 10/10 + 10/10 descriptions válidas e idênticas |
| `npm run validate` | `VALID`, 12 checks |
| `npm test` | 138/138 testes passaram |
| `node --test tests/distribution/*.test.mjs` | 58/58 testes passaram |
| `npm run validate:adapters` | 4 adapters e 4 mappings válidos |
| `npm run validate:distribution` | 164 sources, 64 managed, 9 retirements; válido |
| `npm run pack:local` | pacote oficial gerado; 136 entries |
| inspeção do pacote | 10/10 Skills válidas e byte-idênticas às canônicas |

## Reprodutibilidade do pacote

O pacote oficial local e duas reproduções adicionais isoladas em `/tmp/framework-pack-a.Q12XS0` e `/tmp/framework-pack-b.l3PjPc` produziram exatamente o SHA-256 `d01e4c89ec081018eec5671b0ad725a1561e8c842b4e51042583c88ae068dca8`. As três cópias foram byte a byte idênticas. Os dois diretórios temporários foram removidos após a prova.

## Sentinelas globais e operacionais

Sentinelas iniciais:

- `~/.kiro/**`: `b7759d9d1b1ac71c338a27f1e4ce1e41b7fbd6b7bd0e87d33eb585cd647384b7` (3940 arquivos; 264755725 bytes);
- operação histórica: `16acbbc2cdf22abfaf477777ab80d92bc85e87ac11ffdbaa8e65d681f79a55c0`;
- receipt: `4e1f1984d1ba3ff3084f98135645d35904ce76b3fb1a3941f1e54f0c2b470dad`;
- journal: `f1afbd41721db1bc7d3d13784906dfe58ddf4da350c18bb54c3c8910cf91e569`;
- backup manifest: `256326462208de6f84ebceb6ff421b696d77c7076444f32ca6deab7841ebfbce`.

Verificação final:

- operação histórica: `16acbbc2cdf22abfaf477777ab80d92bc85e87ac11ffdbaa8e65d681f79a55c0`, inalterada;
- receipt: `4e1f1984d1ba3ff3084f98135645d35904ce76b3fb1a3941f1e54f0c2b470dad`, inalterado;
- journal: `f1afbd41721db1bc7d3d13784906dfe58ddf4da350c18bb54c3c8910cf91e569`, inalterado;
- backup manifest: `256326462208de6f84ebceb6ff421b696d77c7076444f32ca6deab7841ebfbce`, inalterado;
- receipt permanece `PRE_RESTART_PENDING`, com `pending_action: skill-bootstrap`;
- 64/64 destinos globais gerenciados preservam os hashes históricos, são arquivos regulares sem symlinks e preservam mode/UID/GID; `bad: []`;
- self-update global `skill-bootstrap` permanece no hash histórico `38d95b69f29dda8e0afa0f9768a3d235c94002fce29fbf14e3cb42a0b8300a79`.

A sentinela ampla observada após a correção foi `21dcdc2da1151a9ecd5ab3cf77b3e1726dc6dd7487ffe9b9c0c617271ad8ef0c` (4006 arquivos; 266043649 bytes), portanto não coincide com a inicial. A atribuição path a path desde a primeira escrita local encontrou inicialmente 187 paths modificados ou criados, exclusivamente `logs/**` (1) e `sessions/**` (186), incluindo o log ativo e snapshots da própria sessão `sess_6fd5ac1f-9ffe-4daf-9d97-8de158725ed4`. No último checkpoint antes do fechamento da evidência eram 196 paths, ainda exclusivamente `logs/**` (1) e `sessions/**` (195). Processos Kiro/Electron estavam ativos durante as medições. Nenhum path normativo/gerenciado ou artefato operacional divergiu. Essa escrita automática de bookkeeping da IDE, fora da execução do framework, é a razão de `COMPLETED_WITH_WARNINGS`.

## Warnings e divergências

1. A sentinela ampla de `~/.kiro/**` divergiu por gravações automáticas da IDE exclusivamente em `logs/**` e `sessions/**`. Não houve escrita global explícita ou operação global executada por esta correção; 64/64 destinos gerenciados permaneceram byte a byte e metadados inalterados.
2. O warning preexistente de `DiscoveryRouter.md` com `removalEligible: false` permaneceu esperado e fora do finding.
3. A primeira tentativa read-only de ler o receipt foi executada fora de `framework/` e falhou com `ERR_MODULE_NOT_FOUND` para `yaml`. Foi repetida a partir de `framework/`, terminou com exit `0` e não causou escrita ou efeito no estado operacional.
4. A primeira checagem final read-only procurou o journal pelo nome incorreto `transaction-journal.jsonl` e falhou com `ENOENT`. O path real `installation-journal.yaml` foi localizado sem mutação; a repetição terminou com exit `0` e confirmou o hash esperado.
5. Não existe `.git` na raiz do projeto; as operações Git são `NOT_APPLICABLE_NO_REPOSITORY`.

## Validações e operações não executadas

- descoberta real das Skills pelo catálogo/runtime Kiro: `NOT_EXECUTED`;
- revalidação por `validate-delivery`: `NOT_EXECUTED`;
- nova operação global completa: `NOT_EXECUTED`;
- restart: `NOT_EXECUTED`;
- Etapa A e Etapa B globais: `NOT_EXECUTED`;
- finalização ou alteração do receipt: `NOT_EXECUTED`;
- Git, remoto, release e deploy: `NOT_EXECUTED`.

Assim, esta rodada confirma zero operação/escrita global iniciada pela correção, zero restart, zero Etapa A, zero Etapa B, zero Git e zero remoto. A única mutação observada dentro de `~/.kiro/**` foi o bookkeeping automático e atribuído da IDE em `logs/**` e `sessions/**`, sem tocar o estado gerenciado.

## Encaminhamento restrito para revalidação

A próxima sessão deve:

- usar a fase `validate-delivery`;
- usar o modo `REVALIDATION`;
- retomar `delivery-assurance/framework-v3-global-bootstrap-layout/round-02-stage-b`;
- selecionar Claude Opus 4.8 / Max;
- usar o agente Default;
- usar Autopilot somente para inspeções read-only ou temporárias;
- usar Claude Opus 4.7 / Max apenas como fallback confirmado;
- revalidar o finding `VAL-GBL-001`, a distribuição reproduzível e, quando separadamente autorizada, planejar uma nova operação global completa.

Esta execução para antes da revalidação e antes de qualquer operação global.