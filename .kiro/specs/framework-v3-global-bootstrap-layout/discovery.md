# Discovery — Layout global do bootstrap v3

Status: APPROVED_FOR_SPEC  
Fase: low-level-discovery  
Projeto: AgenticDevOps  
Slug: framework-v3-global-bootstrap-layout  
Tipo de Spec: spec  
Estratégia de especificação: Design-First  
Origem: formalização da distribuição v3 para bootstrap global do adapter Kiro  
Rodada: round-01  
Linha de sessão: engenharia e autoria  
Estratégia de sessão: retomar sessão autora  
Sessão ou papel: engineering-author/framework-v3  
Agente executor: Kiro  
Superfície: IDE  
Host: Linux  
Família de LLM resolvida: Codex  
Modelo LLM resolvido: GPT-5.6 Sol  
Esforço resolvido: High  
Agente/Workflow Kiro resolvido: Default  
Modo: Supervised — FINALIZE_AFTER_ALIGNMENT  
Branch/Base/HEAD: NOT_EXECUTED — Git foi proibido nesta fase  
Última atualização: 2026-07-28

## Instrução de origem

Investigar e alinhar, sem implementar, como a distribuição v3 deve formalizar um bootstrap global seguro para o adapter Kiro. A entrega deve definir um layout funcional de 64 arquivos gerenciados, um contrato canônico de distribuição e os controles para uma futura operação global reversível. Esta fase não autoriza instalação, remoção, backup real, restart, migração, Git ou escrita remota.

Este artefato pertence exclusivamente ao slug `framework-v3-global-bootstrap-layout`. O discovery anterior do slug `framework-v3` foi consultado apenas como evidência histórica de escopo e não o substitui.

## Objetivo confirmado

Transformar a árvore v3, hoje íntegra e empacotável, em uma distribuição com semântica explícita de origem → destino para o Kiro, sem inferência procedural de paths, sem autoridade v2.3 concorrente após a futura operação autorizada e com instalação global transacional, recuperável, idempotente e verificável.

A especificação deverá ser completa e Design-First: primeiro fechar arquitetura, contratos, estados, invariantes, transação, loader e rollback; somente depois derivar requisitos operacionais detalhados e tarefas executáveis.

## Decisões confirmadas no alinhamento

1. A modalidade é **Spec completa** (`spec`).
2. A estratégia é **Design-First**.
3. O modelo real de carregamento do Kiro é a restrição técnica determinante:
   - Skills globais: `~/.kiro/skills/`;
   - contexto persistente global: `~/.kiro/steering/`;
   - os 63 arquivos espelhados não bastam para provar ativação do core v3.
4. O layout funcional terá **exatamente 64 arquivos gerenciados**:
   - 63 destinos já inventariados;
   - `~/.kiro/steering/agentic-workflow.md` como 64º destino.
5. `agentic-workflow.md` será gerado, fino, adapter-specific e `inclusion: always`. Ele apenas direcionará o Kiro Default ao core/router e às Skills; não será fonte normativa paralela e não copiará workflow, políticas ou contratos completos.
6. O contrato de distribuição ficará em `adapters/kiro/distribution-manifest.yaml`, com schema tool-neutral correspondente em `contracts/schemas/` e planner/validator genéricos em `tools/`.
7. Manifest, schema, planner, validator, templates, testes e fixtures permanecerão `SOURCE_ONLY` ou `BUILD_TEST_ONLY`, conforme a taxonomia.
8. As cinco classes de fonte são `GLOBAL_KIRO_MANAGED`, `SOURCE_ONLY`, `PROJECT_TEMPLATE`, `GENERATED_PACKAGE_CONTENT` e `BUILD_TEST_ONLY`.
9. `LEGACY_ACTIVE_CONFLICT` é estado de destino/migração, não uma sexta classe.
10. Os nove steering v2.3 serão preservados até operação global autorizada, exigirão backup externo e sairão futuramente da superfície ativa sem alias, stub ou redirect. Remoção e restauração exigirão autorização operacional própria.
11. A futura operação produzirá separadamente backup manifest externo, `installation-receipt.yaml`, hashes, permissões, UID/GID e ações executadas.
12. Recibos operacionais são evidência derivada; não são fontes normativas instaladas.
13. `workflow-bootstrap` consumirá o manifest, deixará de inferir paths, será atualizada por último e parará imediatamente com `RESTART_REQUIRED`.
14. A validação pós-restart ocorrerá em nova rodada e provará 64/64 arquivos, referências resolvidas, steering e Skills carregáveis, ausência de autoridade v2.3 concorrente, idempotência e rollback verificável.
15. Adapters ChatGPT, Codex e Claude permanecem fora da instalação global Kiro.
16. O adapter ChatGPT não será ativado antes da instalação e validação global da v3.
17. O primeiro projeto piloto será `AgenticDevOps`, em `PROJECT_UPDATE`, somente após a instalação global ser validada.
18. Spec e implementação local não autorizam instalação, backup real, remoção, restart, migração, alteração do ChatGPT Project, Git ou escrita remota.

Não permanece decisão material de produto aberta para iniciar a Spec. Detalhes internos derivados dessas decisões devem ser fechados no design sem alterar os limites aprovados.

## Problema real

### Sintoma

`framework.lock` e o pacote v3 provam quais arquivos pertencem à árvore-fonte, mas não definem quais arquivos devem ser instalados globalmente, em quais destinos, com qual finalidade, ownership, política de conflito ou ordem operacional.

### Comportamento observado

- **CONFIRMED_DIRECTLY:** `framework/tools/lib/source-lock.mjs` produz e valida `path → sha256` da árvore-fonte; não representa destinos.
- **CONFIRMED_DIRECTLY:** `framework/tools/lib/dry-run.mjs` classifica risco abstrato; não cria plano de instalação por item.
- **CONFIRMED_DIRECTLY:** `framework/adapters/kiro/adapter.yaml` não declara destinos globais.
- **CONFIRMED_DIRECTLY:** `framework/policies/ownership.yaml` não possui domínio de distribuição.
- **CONFIRMED_DIRECTLY:** não existem manifest source→destination, install-state, journal transacional ou executores de apply/resume/rollback.
- **CONFIRMED_DIRECTLY:** os gerados atuais de Skills são cópias documentais; não provam resolução das referências pelo loader Kiro.
- **CONFIRMED_DIRECTLY:** o inventário candidato original contém 63 arquivos sem colisões case-fold.
- **CONFIRMED_DIRECTLY:** `framework.lock` mantém integridade de 143/143 entradas.
- **CONFIRMED_DIRECTLY:** `agentic-devops-framework-v3-3.0.0.tgz` mantém SHA-256 `c11b3dde169c81440a8038b1cca2a41ce3e1e7691f93f2ba55dbbec54524ed6f`.
- **CONFIRMED_DIRECTLY:** os 19 arquivos globais v2.3 atuais permanecem byte a byte idênticos ao baseline `Kiro_v2_3_source`.
- **CONFIRMED_DIRECTLY:** nenhuma escrita global foi realizada nesta investigação ou finalização.

### Comportamento esperado

A distribuição deverá declarar e validar:

1. finalidade e provenance de cada arquivo-fonte;
2. mapeamento explícito de cada arquivo gerenciado para destino;
3. layout global exato de 64 arquivos;
4. mecanismo comprovável de carregamento das Skills e do steering no Kiro;
5. estados de destino, legado, conflito e arquivos não gerenciados;
6. snapshot autorizado, backup externo, journal, receipt, apply, resume e rollback;
7. ordem de self-update da Skill e interrupção `RESTART_REQUIRED`;
8. validação pós-restart em rodada própria;
9. segunda execução idempotente, sem regravar arquivos idênticos.

### Reprodução conceitual

1. Verificar pacote e `framework.lock`: a integridade da fonte é confirmada.
2. Consultar adapter e ownership: não existe mapa completo de instalação.
3. Tentar derivar destinos: a Skill precisaria inferir convenções e paths.
4. Espelhar somente os 63 arquivos: relações físicas são preservadas, mas o core não recebe um entrypoint persistente documentado no Kiro.
5. Remover os steering v2.3 sem o 64º arquivo: a superfície global fica sem o direcionador v3 aprovado.

Frequência: determinística em toda tentativa de bootstrap global baseada apenas no pacote atual.

## Causa

### Causa imediata

Ausência de contrato adapter-specific que conecte fontes canônicas a destinos globais e seja consumido por planner/validator operacional.

### Causa raiz

A entrega original separou deliberadamente construção, validação e empacotamento de instalação global. `REQ-054`, o design e a validação do slug `framework-v3` registram instalação/migração como operação futura fora de escopo. Integridade de fonte foi implementada; distribuibilidade global executável não foi contratada.

### Fatores contribuintes

- layout físico tratado como aproximação de runtime sem teste real de discovery/load;
- lock sem finalidade ou destino;
- conhecimento procedural de paths concentrado na Skill;
- alias `DiscoveryRouter.md` com lifecycle de compatibilidade distinto de steering normativo;
- gerados atuais sem prova de resolução de referências externas.

### Confiança

**Alta.** A ausência dos componentes foi observada diretamente e o fora de escopo original foi reconfrontado nos artefatos canônicos.

## Classificação do problema

- **CONFIRMED_DIRECTLY:** existe gap real de distribuibilidade global segura.
- **CONFIRMED_DIRECTLY:** o gap não viola o contrato original, que excluía instalação global.
- **Decisão confirmada:** trata-se de capacidade arquitetural nova, não regressão contratada; por isso a modalidade é `spec`, não `bug-fix`.

## Restrição técnica determinante: loader real do Kiro

A documentação oficial consultada sustenta:

- Skills pessoais em `~/.kiro/skills/<slug>/SKILL.md` ([Kiro Skills](https://kiro.dev/docs/skills.md), [CLI Skills](https://kiro.dev/docs/cli/skills.md));
- steering global em `~/.kiro/steering/*.md` ([Kiro Steering](https://kiro.dev/docs/steering.md), [CLI Steering](https://kiro.dev/docs/cli/steering.md));
- configuração de agentes e ferramentas como mecanismo distinto ([Agent configuration](https://kiro.dev/docs/cli/v3/agent-config.md), [Custom agents](https://kiro.dev/docs/cli/custom-agents/configuration-reference.md));
- workspaces e ferramentas não implicam descoberta de árvores arbitrárias ([Multi-root workspaces](https://kiro.dev/docs/editor/multi-root-workspaces.md), [Built-in tools](https://kiro.dev/docs/cli/reference/built-in-tools.md)).

Consequências aprovadas:

- `~/.kiro/core/**` e `~/.kiro/adapters/**` podem existir como suporte gerenciado, mas não são entrypoints globais documentados.
- Links Markdown externos não constituem, sozinhos, prova de carregamento transitivo.
- O layout precisa do steering `agentic-workflow.md` com `inclusion: always`.
- O steering deve ser fino: direciona o Kiro Default ao core/router e às Skills, sem duplicar conteúdo normativo.
- As referências devem ser resolvidas e validadas no layout staged e novamente após restart.

Conteúdo das fontes oficiais foi parafraseado para conformidade com restrições de licenciamento.

## Layout global funcional aprovado: 64 arquivos

### 63 destinos previamente inventariados

| Grupo de origem | Quantidade | Papel |
|---|---:|---|
| `core/**` | 5 | suporte normativo global |
| `policies/**` | 10 | políticas referenciadas |
| `contracts/**` | 25 | contratos e schemas necessários |
| `skills/**` | 20 | dez Skills e conteúdo associado |
| `adapters/kiro/**` | 3 | configuração/compatibilidade Kiro |
| **Subtotal** | **63** | inventário previamente confirmado |

### 64º destino

`~/.kiro/steering/agentic-workflow.md`

Propriedades obrigatórias:

- gerado;
- fino;
- adapter-specific;
- front matter `inclusion: always`;
- direciona somente o Kiro Default ao core/router e às Skills;
- não redefine workflow, políticas ou contratos;
- não copia fontes normativas completas;
- possui provenance `generated_from` explícita;
- é validado no layout staged e no Kiro pós-restart.

O total aprovado é **64/64**. Novos destinos globais exigem nova decisão material e atualização do contrato; arquivos SOURCE_ONLY/BUILD_TEST_ONLY não aumentam esse inventário.

## Taxonomia aprovada

As classes descrevem a finalidade da fonte. O estado de gerenciamento/destino é um eixo separado, permitindo que um artefato gerado seja materializado em destino global sem criar uma sexta classe.

| Classe | Semântica |
|---|---|
| `GLOBAL_KIRO_MANAGED` | Fonte copiada diretamente para destino global gerenciado |
| `SOURCE_ONLY` | Fonte usada por governança, geração ou tooling, sem destino global direto |
| `PROJECT_TEMPLATE` | Template materializável somente em operação de projeto própria |
| `GENERATED_PACKAGE_CONTENT` | Conteúdo derivado com `generated_from`, incluindo o steering gerado |
| `BUILD_TEST_ONLY` | Testes, fixtures e auxiliares sem destino operacional |

`LEGACY_ACTIVE_CONFLICT` é estado de destino/migração. Não é classe de fonte.

Manifest, schema, planner, validator e templates ficam `SOURCE_ONLY` ou `PROJECT_TEMPLATE`, conforme finalidade. Testes e fixtures ficam `BUILD_TEST_ONLY`. O `agentic-workflow.md` é `GENERATED_PACKAGE_CONTENT` e seu destino é globalmente gerenciado pelo manifest.

## Componentes e ownership do contrato de distribuição

| Responsabilidade | Local aprovado |
|---|---|
| Instância do manifest Kiro | `framework/adapters/kiro/distribution-manifest.yaml` |
| Schema tool-neutral | `framework/contracts/schemas/distribution-manifest.schema.yaml` ou nome final equivalente no mesmo domínio |
| Planner/consumidor genérico | `framework/tools/lib/distribution.mjs` |
| Validator genérico | `framework/tools/validate-distribution.mjs` ou nome consistente com os comandos oficiais |
| Orquestração | `framework/skills/workflow-bootstrap/SKILL.md`, consumindo o plano |

### Campos globais mínimos

- versão de schema/manifest e versão da distribuição;
- adapter e raízes simbólicas autorizadas;
- platform/path semantics;
- inventário esperado 64/64;
- ordem de fases e self-update;
- entrypoints e referências obrigatórias;
- invariantes de completude, exclusividade, provenance e colisão;
- política de estados de destino, legado e unmanaged;
- vínculo com pacote e `framework.lock`;
- versão de journal, backup manifest e receipt;
- condição de `RESTART_REQUIRED`.

### Campos mínimos por item

- ID estável;
- source e destination normalizados;
- classe de fonte;
- adapter/escopo;
- ownership e estado de gerenciamento;
- hash ou referência verificável ao lock;
- `generated_from`, quando aplicável;
- política de mode/metadados;
- ordem/fase operacional;
- política para pre-state ausente, idêntico, legado conhecido, divergente e unmanaged;
- loader requirement;
- ação de rollback.

### Invariantes

- cada destino dos 64 deriva de exatamente um item autorizado;
- todo item global deriva de fonte/payload verificado;
- nenhum destino contém traversal, escape de raiz, symlink seguido ou colisão case-fold;
- manifest rejeita missing, extra e item não classificado;
- `framework.lock` protege manifest e fontes; o pacote inclui ambos;
- lock e pacote não substituem a semântica source→destination;
- `workflow-bootstrap` consome o plano e não mantém mapa paralelo de paths.

## Escopo da Spec

### Dentro do escopo

- manifest Kiro e schema tool-neutral;
- planner e validator genéricos;
- classificação completa das fontes;
- geração do `agentic-workflow.md`;
- reconciliação package/lock/manifest/payload;
- dry-run e plano por item;
- staging sintético e validação de referências;
- estados de destino e política de conflito;
- backup manifest/receipt como contratos operacionais derivados;
- journal, apply, resume e rollback implementáveis em roots sintéticas;
- self-update de `workflow-bootstrap` por último;
- status `RESTART_REQUIRED`;
- testes, fixtures e validação dos comportamentos locais/sintéticos;
- contrato da rodada pós-restart;
- preparação do piloto `AgenticDevOps` em `PROJECT_UPDATE`, sem executá-lo.

### Fora do escopo e não autorizado

- alterar `~/.kiro`;
- criar backup real;
- remover ou restaurar steering v2.3;
- instalar globalmente a v3;
- reiniciar Kiro;
- executar validação pós-restart real nesta entrega local;
- migrar o projeto piloto;
- ativar adapter ChatGPT;
- instalar adapters ChatGPT, Codex ou Claude no global Kiro;
- alterar ChatGPT Project;
- Git, remoto, publicação, release ou deploy;
- modificar o contrato original do slug `framework-v3`;
- tratar receipts como fontes normativas instaladas.

## Legado v2.3 e mixed authority

### Estado confirmado

Os 19 arquivos globais atuais correspondem ao baseline v2.3 conhecido:

- dez Skills;
- nove steering: `workflow-core.md` e oito contratos.

Os nove steering permanecem ativos até uma operação global separadamente autorizada. Mantê-los junto à autoridade v3 após instalação causaria mixed authority.

### Política aprovada

| Estado observado | Resultado futuro |
|---|---|
| Baseline v2.3 byte a byte idêntico | elegível a backup e retirada no lote operacional autorizado |
| Ausente | `NO_ACTION` |
| Divergente, mais novo, tipo inesperado ou symlink | `CONFLICT`/`BLOCKED` |
| Desconhecido ou não gerenciado | `PRESERVE_UNMANAGED` |

Regras:

- nenhum dos nove steering será removido durante Spec ou implementação local;
- backup externo íntegro precede qualquer retirada;
- os nove sairão da superfície ativa sem alias, stub ou redirect;
- remoção e restauração exigem autorização operacional própria;
- `agentic-workflow.md` não reaproveita os nomes legados;
- as dez Skills v2.3 serão atualizadas apenas pelo plano global autorizado;
- `DiscoveryRouter.md` permanece conforme seu lifecycle v3 atual; não substitui o steering global.

## Fluxo operacional futuro

### Preflight e dry-run

1. Resolver host, raízes e paths reais.
2. Validar Node 24.x e npm sem instalar runtime.
3. Verificar pacote, hash, `framework.lock` e manifest.
4. Validar 64/64, classes, provenance, colisões, containment e loader requirements.
5. Capturar snapshot vinculado à autorização.
6. Classificar cada destino sem mutação.
7. Produzir plano, backup esperado, efeitos, conflitos e critérios de interrupção.
8. Solicitar autorização operacional específica.

### Apply transacional

1. Criar staging fora da superfície ativa.
2. Verificar bytes, classes e referências no layout staged.
3. Criar backup externo e backup manifest antes da primeira substituição.
4. Criar journal por item com pre-state e ação pretendida.
5. Aplicar somente itens cujo snapshot permaneça idêntico ao autorizado.
6. Registrar `installation-receipt.yaml`, hashes, permissões, UID/GID e ações executadas.
7. Atualizar `workflow-bootstrap` por último.
8. Parar imediatamente com `RESTART_REQUIRED`.

Backup manifest e receipt ficam fora da superfície normativa instalada e não contam entre os 64 arquivos.

### Falha parcial, resume e idempotência

- estados por item: não iniciado, preparado, aplicado, verificado e falha conhecida;
- nenhuma repetição após efeito incerto;
- resume somente em `KNOWN_RECOVERABLE` confirmado por journal e estado real;
- divergência entre journal, snapshot e filesystem bloqueia;
- arquivo idêntico resulta em `NO_CHANGE`, sem regravação;
- metadados não mudam sem necessidade contratada;
- segunda execução pós-restart deve provar idempotência.

### Backup e rollback

O backup externo registra path, hash/bytes, tipo, mode, UID/GID quando suportado, pre-state, integridade e ação relacionada.

Rollback:

- não depende de Git;
- restaura somente itens atribuídos ao lote e registrados no journal;
- restaura bytes e metadados capturados;
- remove arquivo novo somente se `pre-state=absent` e o conteúdo atual ainda corresponder ao aplicado;
- não usa glob, limpeza ampla ou remoção de unmanaged;
- é operação real de alto risco e exige autorização própria.

## Validação pós-restart

A atualização de `workflow-bootstrap` encerra a rodada operacional. A validação ocorrerá em **nova rodada**, após restart, e deverá provar:

1. 64/64 arquivos nos destinos esperados;
2. hashes e metadados coerentes com manifest/receipt;
3. referências resolvidas;
4. `agentic-workflow.md` carregável com `inclusion: always`;
5. dez Skills carregáveis pelo Kiro;
6. ausência dos nove steering v2.3 na superfície ativa;
7. ausência de autoridade normativa v2.3 concorrente;
8. segunda execução idempotente com `NO_CHANGE`;
9. rollback verificável contra backup manifest/journal/receipt;
10. nenhuma ativação dos adapters ChatGPT, Codex ou Claude.

Somente depois dessa validação o piloto `AgenticDevOps` poderá seguir, em autorização própria, no modo `PROJECT_UPDATE`. O adapter ChatGPT permanece desativado até a instalação e validação global da v3.

## Segurança e alto risco

A futura instalação global altera regras carregadas por todas as sessões Kiro do usuário e substitui autoridade ativa. O overlay de alto risco se aplica proporcionalmente à operação futura.

Controles obrigatórios:

- `realpath` + `lstat`, containment e no-follow de symlink;
- rejeição de traversal, path absoluto indevido e colisão case-fold;
- verificação encadeada package → lock → manifest → source/payload;
- staging separado da superfície ativa;
- snapshots antes da autorização e de cada escrita material;
- backup externo verificado antes da primeira substituição;
- journal e receipt por item;
- preservação de unmanaged e fail-closed em divergência;
- sem elevação de privilégio ou segredo em comando/evidência;
- modo supervisionado, dry-run e checkpoints para operação real;
- rollback e critérios de interrupção definidos antes do apply;
- nenhuma instalação, remoção, restart, migração ou escrita remota por inferência.

Ativos protegidos: regras globais, Skills, customizações, histórico operacional, integridade da distribuição e disponibilidade das sessões Kiro.

## Preservações obrigatórias

- preservar `Kiro_v2_3_source/`, `Kiro_v2_4_source/` e `Analise_Workflow_v3.0.md`;
- preservar core v3 tool-neutral;
- preservar adapters ChatGPT/Codex/Claude como `SOURCE_ONLY` e fora do global Kiro;
- preservar lifecycle/compatibilidade de `DiscoveryRouter.md`;
- preservar arquivos de suporte realmente exigidos pelas Skills;
- preservar unmanaged e customizações;
- preservar bytes e metadados substituídos no backup;
- preservar Node 24.x, `npm run validate` e `npm test` como referências do projeto;
- preservar separação entre build/package, implementação local, instalação global, piloto, Git, release e deploy;
- não alterar distribuição nem `~/.kiro` durante Spec, Contract Review, implementação local ou validação local.

## Critérios iniciais de aceite

1. O manifest representa exatamente 64 destinos globais gerenciados e rejeita missing/extra.
2. Os 63 candidatos permanecem rastreáveis e o 64º é `~/.kiro/steering/agentic-workflow.md`.
3. O steering é gerado, fino, adapter-specific, `inclusion: always` e sem duplicação normativa.
4. Pacote, lock, manifest, classes, gerados e payload reconciliam sem divergência.
5. As dez Skills e suas referências são carregáveis no Kiro real.
6. Manifest, schema, planner, validator, templates, testes e fixtures não são instalados como fontes normativas globais.
7. Dry-run não modifica fonte, global, projeto, backup ou Git.
8. Clean install, update e segunda execução produzem estados determinísticos.
9. Arquivo idêntico resulta em `NO_CHANGE` sem regravação.
10. Legado idêntico é planejável; divergente/symlink/newer bloqueia; unmanaged é preservado.
11. Os nove steering v2.3 só saem após backup e autorização, sem alias/stub/redirect.
12. Falha injetada deixa estado classificável e permite somente resume/rollback seguro.
13. Backup manifest e receipt registram hashes, permissões, UID/GID e ações executadas sem se tornarem fontes normativas.
14. Rollback restaura bytes e metadados atribuídos e não remove unmanaged.
15. `workflow-bootstrap` consome o manifest, é atualizada por último e retorna `RESTART_REQUIRED`.
16. Mudança de snapshot após autorização interrompe antes da escrita correspondente.
17. Sem Node 24.x ou npm, o resultado é `NEEDS_STATE_VALIDATION`, sem instalação automática.
18. A validação pós-restart ocorre em nova rodada e prova 64/64, loader, ausência de mixed authority, idempotência e rollback.
19. Adapters ChatGPT/Codex/Claude permanecem fora da instalação Kiro; ChatGPT não é ativado antecipadamente.
20. O piloto `AgenticDevOps` só ocorre depois da validação global, em `PROJECT_UPDATE` separado.
21. Nenhuma operação global, Git ou remota ocorre sem autorização própria.
22. Paths Linux e Windows são validados com semântica nativa e contenção equivalente.

## Testes e fixtures necessários para a futura Spec

### Cobertura existente

| Teste/evidência | Cobertura | Gap preservado |
|---|---|---|
| `framework/tests/skills/skills.test.mjs` | canonicidade, geração e progressive loading documental | não prova instalação/discovery Kiro |
| `framework/tests/compatibility/compatibility.test.mjs` | lifecycle do alias | não prova steering global normativo |
| `framework/tests/policies/dry-run.test.mjs` | classificação abstrata e fail-closed | não prova plano/transação |
| validação do slug `framework-v3` | 11/11 validators e 77/77 testes | instalação global foi `NOT_EXECUTED` |

### Cobertura mínima nova

- validação estrutural do manifest, classes e 64/64;
- clean install e update em raiz sintética;
- `NO_CHANGE` e idempotência;
- fixture v2.3 com nove steering e dez Skills;
- destino modificado, mais novo, sem permissão ou tipo inesperado;
- traversal, symlink, escape de raiz e colisão case-fold;
- geração fina do `agentic-workflow.md` e ausência de duplicação normativa;
- referências exercitadas no layout staged;
- arquivo desconhecido preservado;
- backup externo íntegro e metadados restauráveis;
- receipt e journal consistentes;
- falha injetada em cada etapa com resume/rollback;
- self-update por último e `RESTART_REQUIRED`;
- snapshot alterado após aprovação;
- manifest incompleto, destino duplicado e arquivo extra;
- dry-run sem mutação;
- reconciliação package/lock/manifest/payload;
- paths Linux e Windows;
- teste real pós-restart de steering e dez Skills no Kiro.

Testes locais de filesystem usam roots temporárias sintéticas e nunca `~/.kiro` real.

## Premissas confirmadas e refutadas

### Confirmadas

- a distribuição precisa de manifest cobrindo os 63 candidatos e o steering gerado;
- a instalação futura carrega suporte global e adapter Kiro;
- os nove steering v2.3 não podem coexistir com a autoridade v3 validada;
- backup, rollback, restart e idempotência são materiais;
- self-update é a última escrita;
- instalação e piloto são operações posteriores separadas.

### Refutadas ou qualificadas

- **Refutada:** espelhar 63 arquivos basta para ativar o core v3.
- **Resolvida pelo alinhamento:** o inventário funcional foi fechado em exatamente 64 destinos gerenciados nesta entrega.
- **Refutada:** `framework.lock` pode substituir o manifest.
- **Refutada:** `DiscoveryRouter.md` substitui o steering normativo.
- **Refutada:** aliases/stubs/redirections v2.3 devem ser preservados após migração.
- **Refutada:** trata-se de bug contra o contrato original.

## Alternativas rejeitadas

- inferir destinos dentro da Skill;
- usar `framework.lock` como mapa de instalação;
- instalar somente os 63 paths;
- remover steering v2.3 sem entrypoint v3 e backup;
- manter alias, stub ou redirect para os nove steering legados;
- copiar workflow/políticas/contratos completos para o steering gerado;
- instalar adapters não Kiro;
- tratar receipt como fonte normativa.

## Recomendação técnica consolidada

Implementar, após Spec e Contract Review, um contrato de distribuição Kiro adapter-specific, validado por schema tool-neutral e consumido por planner/validator genéricos. O manifest classifica fontes, declara exatamente 64 destinos e gerados, reconcilia package/lock/payload, produz plano por item e permite dry-run, staging, backup, journal, receipt, apply, resume e rollback fail-closed. `workflow-bootstrap` apenas orquestra o plano, atualiza-se por último e encerra com `RESTART_REQUIRED`.

A operação real permanece separada: a implementação prova mecanismos em roots sintéticas. Tocar `~/.kiro`, retirar steering v2.3, reiniciar Kiro e executar o piloto exigem fases e autorizações próprias.

## Tipo e estratégia de Spec

- Tipo confirmado: **`spec` completa**.
- Estratégia confirmada: **Design-First**.
- Restrição determinante: modelo real de carregamento do Kiro em `~/.kiro/skills/` e `~/.kiro/steering/`.
- Motivo: arquitetura transversal, loader, contrato de distribuição, transação, backup/rollback, self-update, restart e alto risco operacional futuro.

`bug-fix` permanece inadequado porque não houve regressão contratada. `quick-spec` permanece inadequada pela transversalidade e pelo risco.

## Combinação recomendada para a próxima fase

Agente executor: Kiro  
Superfície: IDE  
Host: Linux  
Fase: spec  
Skill: `spec`  
Família de LLM: Cloud Opus  
Modelo LLM: Claude Opus 4.8  
Esforço: High  
Agente/Workflow Kiro: Spec  
Modo de execução: Supervised  
Estratégia de sessão: retomar sessão autora  
Sessão de destino: `engineering-author/framework-v3`  
Contratos: ContextPolicy, GitSafetyPolicy, ArtifactContract, EvidenceAndFeedbackContract, SecureDevelopmentPolicy, ModelSelectionPolicy  
Overlay: HighRiskOverlay proporcional à futura operação global  
Fallback: Codex / GPT-5.6 Sol / High, somente se Claude Opus 4.8 estiver indisponível, o seletor confirmar GPT-5.6 Sol e o uso experimental for aceito antes da fase.  
Disponibilidade: confirmar no seletor real antes de iniciar.

Justificativa: Spec Design-First complexa, transversal e de alto custo de omissão; continuidade da sessão preserva a investigação. O primeiro Contract Review posterior continuará exigindo nova sessão independente.

## Evidências consultadas

### CONFIRMED_DIRECTLY

- source-lock, dry-run, adapter Kiro, ownership, skills e compatibility;
- package, lock e inventário de 63 candidatos;
- 143/143 hashes do `framework.lock`;
- hash do pacote;
- 19 globais v2.3 e equivalência ao baseline;
- testes e artefatos canônicos do slug `framework-v3`;
- ausência de manifest, install-state, journal e executores operacionais;
- diretório deste slug contendo somente `discovery.md` antes da finalização.

### CONFIRMED_DIRECTLY por fonte oficial

- paths documentados de Skills e steering globais do Kiro, conforme links da seção de loader.

### DECIDED

- Design-First;
- exatamente 64 destinos;
- `agentic-workflow.md` fino e always-included;
- taxonomia, ownership e artefatos operacionais;
- política de legado sem aliases;
- validação pós-restart e piloto posterior.

### NOT_EXECUTED

- Git;
- Spec e Contract Review;
- implementação ou geração;
- testes de produto, `npm ci` ou empacotamento;
- instalação ou alteração de `~/.kiro`;
- backup, receipt ou rollback real;
- remoção de steering;
- restart e validação pós-restart;
- migração `PROJECT_UPDATE`;
- alteração/ativação do ChatGPT Project;
- remoto, publicação, release ou deploy.

## Estado final das superfícies

- Fonte v3: nenhuma alteração nesta fase.
- Instalação global `~/.kiro`: nenhuma alteração; baseline v2.3 19/19 intacto.
- Slug anterior `.kiro/specs/framework-v3/**`: nenhuma alteração.
- Referências v2.3/v2.4 e `Analise_Workflow_v3.0.md`: nenhuma alteração.
- ChatGPT Project: nenhuma alteração.
- Git/remoto: não executados.
- Única escrita autorizada da finalização: este `discovery.md`.

## Prontidão

**APPROVED_FOR_SPEC**

O alinhamento resolveu as decisões materiais. O artefato está pronto para uma Spec completa Design-First na mesma sessão autora. Esta aprovação autoriza somente a próxima fase de especificação quando instruída separadamente; não autoriza implementação, operação global, Git ou remoto.
