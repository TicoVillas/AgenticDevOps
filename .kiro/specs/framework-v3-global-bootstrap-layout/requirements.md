# Requirements — Layout global manifest-driven do framework v3

Status: FINAL  
Fase: spec  
Projeto: AgenticDevOps  
Slug: framework-v3-global-bootstrap-layout  
Estratégia: Design-First  
Linha de sessão: engenharia e autoria  
Sessão: engineering-author/framework-v3  
Origem: `discovery.md` — `APPROVED_FOR_SPEC`; arquitetura vinculante em `design.md`  
Última atualização: 2026-07-28

## Objetivo

Definir uma distribuição global v3 segura e verificável para o adapter Kiro, com exatamente 64 arquivos gerenciados, mapeamento explícito de fonte para destino, entrypoint global compatível com o loader real do Kiro e mecanismos implementáveis de planejamento, backup, aplicação, retomada, rollback e validação pós-restart.

A entrega desta Spec implementará apenas contratos, tooling e testes locais/sintéticos. Instalação em `~/.kiro`, retirada de legado, backup real, restart, validação global, piloto de projeto, Git e remoto continuam operações posteriores não autorizadas.

## Usuários e fluxos

### Operador do framework

Precisa validar a distribuição e obter um plano determinístico antes de decidir qualquer operação global.

### Kiro Default

Precisa carregar um steering global fino e, a partir dele, resolver o core/router e a Skill adequada sem autoridade normativa duplicada.

### Reviewer e validator

Precisam provar que o contrato contém exatamente o inventário aprovado, que a implementação não escreve na raiz global real e que os controles de alto risco são exercitáveis em roots sintéticas.

### Fluxos contratados

1. Validar fontes, catálogo, manifest, gerados, lock e pacote.
2. Classificar uma raiz de destino sem mutação e produzir plano por item.
3. Exercitar apply, falha parcial, resume e rollback somente em roots sintéticas.
4. Em operação futura separada, executar Etapa A sob checkpoint, terminar no self-update com `RESTART_REQUIRED` e parar.
5. Em nova execução pós-restart, executar Etapa B e comprovar 64/64, loader, ausência de mixed authority e idempotência.
6. Somente após validação global, permitir um piloto `PROJECT_UPDATE` separado.

## Requisitos funcionais

### REQ-001 — Inventário global exato de 64 arquivos

O contrato de distribuição deve declarar exatamente 64 destinos globais gerenciados, sem itens ausentes, extras ou duplicados:

- 5 em `core/**`;
- 10 em `policies/**`;
- 25 em `contracts/**`, sendo 2 documentos, 16 schemas e 7 templates preexistentes;
- 20 em `skills/**`, sendo 10 `SKILL.md` e 10 referências;
- 3 em `adapters/kiro/**`;
- 1 em `steering/agentic-workflow.md`.

O mapa source → destination da seção “Mapa completo dos 64 itens” em `design.md` é vinculante.

**Critérios de aceite**

- O validator aprova exatamente 64 `managed_items` e 64 destinos únicos.
- Remover, adicionar, duplicar ou remapear qualquer item causa falha determinística.
- O 64º destino é exatamente `~/.kiro/steering/agentic-workflow.md`.
- Diretórios e artefatos operacionais não contam entre os 64.

### REQ-002 — Catálogo completo e classificação das fontes

Toda fonte protegida por `framework.lock` deve possuir exatamente uma entrada em `source_catalog` e uma das cinco classes:

- `GLOBAL_KIRO_MANAGED`;
- `SOURCE_ONLY`;
- `PROJECT_TEMPLATE`;
- `GENERATED_PACKAGE_CONTENT`;
- `BUILD_TEST_ONLY`.

`LEGACY_ACTIVE_CONFLICT` deve permanecer estado de destino/migração, nunca classe de fonte.

**Critérios de aceite**

- Fonte locked sem classificação, classificação desconhecida ou fonte catalogada não locked falha.
- Conteúdo gerado declara `generated_from` válido.
- A classificação é exclusiva e versionada.
- O validator distingue o catálogo completo do subconjunto de 64 itens instaláveis.

### REQ-003 — Metadados e integridade por item

Cada fonte e item gerenciado deve declarar ID estável, versão, hash, source, destination, classe, escopo do adapter, owner, group, mode, fase de aplicação, dependências, loader role e política de self-update aplicáveis.

**Critérios de aceite**

- Todo hash de fonte coincide com `framework.lock`.
- Em Linux, os metadados esperados são usuário instalador, grupo primário do usuário e mode `0644`; diretórios criados usam `0755`.
- Em host sem semântica POSIX, a observação registra `NOT_APPLICABLE` para UID/GID/mode não suportados sem desativar containment ou proteção de ACL.
- Timestamp não determina identidade e não muda em `NO_CHANGE`.

### REQ-004 — Steering global determinístico

A distribuição deve gerar `adapters/kiro/generated/agentic-workflow.md` e mapeá-lo para `~/.kiro/steering/agentic-workflow.md`.

O steering deve ser fino, adapter-specific, possuir front matter `inclusion: always` e direcionar o Kiro Default ao core/router e às Skills globais.

**Critérios de aceite**

- Mesmas fontes produzem bytes e hash idênticos.
- A saída não contém timestamp, host ou path absoluto.
- A saída possui provenance e indicação de conteúdo gerado.
- O loader role é `STEERING_ENTRYPOINT`.
- O layout staged e a futura Etapa B conseguem resolver suas referências.

### REQ-005 — Ausência de segunda autoridade normativa

O steering gerado não deve copiar, redefinir ou substituir o conteúdo completo de workflow, políticas, contratos ou Skills.

**Critérios de aceite**

- Teste anti-duplicação rejeita conteúdo normativo incorporado além das referências e instruções mínimas de roteamento.
- Existe uma única fonte canônica para cada regra referenciada.
- O steering não reutiliza os nove nomes legados retirados.

### REQ-006 — Planner estritamente read-only

O planner deve receber manifest, lock, raízes, snapshot e provenance e produzir classificação, ações previstas, backup set, dependências, riscos, checkpoints e critérios de interrupção sem mutar qualquer superfície.

**Critérios de aceite**

- Planejamento não cria, altera, remove, renomeia, chmod/chown ou abre temporário persistente.
- Fonte, destino, backup, projeto e Git permanecem byte a byte/estado a estado inalterados.
- A ordem do plano é determinística por dependência e ID.
- Qualquer estado não controlado produz decisão global `BLOCKED`.
- Operação global é classificada como `CHECKPOINT_REQUIRED`.

### REQ-007 — Validator estrutural e semântico

O validator deve validar schema, referências, completude do catálogo, mapa 64, ordem topológica, generated provenance, legacy retirements, adapter, loader e reconciliação entre manifest, lock, gerados e pacote.

**Critérios de aceite**

- IDs, sources e destinations duplicados falham.
- Paths absolutos, traversal, escapes e enums desconhecidos falham.
- Dependência ausente ou cíclica falha.
- Existe exatamente um item de self-update e ele é topologicamente a última escrita.
- Existe exatamente um steering always-included.
- O manifest contém exatamente nove retirements legados explícitos, sem glob ou diretório.

### REQ-008 — Estados de destino e decisão fail-closed

O sistema deve reconhecer pelo menos:

`ABSENT`, `IDENTICAL`, `MANAGED_OUTDATED`, `MANAGED_DIVERGENT`, `METADATA_DIVERGENT`, `LEGACY_ACTIVE_CONFLICT`, `LEGACY_MODIFIED`, `UNMANAGED_PRESENT`, `SYMLINK_UNEXPECTED`, `TYPE_CONFLICT`, `OUTSIDE_ROOT`, `SOURCE_HASH_MISMATCH` e `UNKNOWN_PARTIAL`.

**Critérios de aceite**

- `IDENTICAL` produz `NO_CHANGE`.
- `ABSENT` e `MANAGED_OUTDATED` só geram mutação planejada condicionada a autorização e backup aplicável.
- `MANAGED_DIVERGENT`, `LEGACY_MODIFIED`, `UNMANAGED_PRESENT`, symlink, tipo conflitante, escape, source drift e estado parcial desconhecido bloqueiam.
- `METADATA_DIVERGENT` exige checkpoint e não é corrigido silenciosamente.
- Conteúdo local modificado nunca é sobrescrito por heurística.

### REQ-009 — Preconditions da futura Etapa A

A futura Etapa A só pode começar quando manifest, lock, pacote, gerados, plano, snapshot, backup target, rollback, ambiente e autorização específica forem válidos e atuais.

**Critérios de aceite**

- Mudança em snapshot, branch/HEAD quando aplicável, paths, fonte, destino, autorização ou operação expira o lote.
- Node major diferente de 24 ou ausência de npm produz `NEEDS_STATE_VALIDATION`, sem instalação automática.
- Plano contendo item `BLOCKED` impede qualquer mutação.
- A operação real exige modo `Supervised` e checkpoint próprio.

### REQ-010 — Backup, journal e receipt verificáveis

Toda ação futura que possa substituir ou retirar arquivo deve possuir backup externo verificado, intent em journal e registro derivado de execução.

**Critérios de aceite**

- Backup manifest registra path, pre-state, hash/bytes, tamanho, tipo, mode e UID/GID quando suportados, destino do backup e verificação.
- Backup incompleto, inconsistente ou não restaurável bloqueia apply.
- Journal diferencia `PLANNED`, `BACKED_UP`, `APPLYING`, `APPLIED`, `VERIFIED`, `FAILED_KNOWN` e `UNKNOWN`.
- Receipt registra somente ações executadas e verificadas; planejado não aparece como concluído.
- Backup, journal e receipt ficam fora de `~/.kiro` e não contam entre os 64.

### REQ-011 — Ordem de aplicação da futura Etapa A

A ordem deve ser: suporte → adapter → referências de Skills → Skills não-self-update → entrypoint → retirada de legado → verificações pré-self-update → `workflow-bootstrap/SKILL.md`.

**Critérios de aceite**

- Dependências são aplicadas e verificadas antes de consumidores.
- O entrypoint só é aplicado após core/router e Skills estarem staged e validados.
- A retirada de legado só ocorre após backup íntegro e entrypoint aplicado/verificado.
- O item de self-update é a última escrita de qualquer tipo da Etapa A.

### REQ-012 — Retirada controlada dos nove steering v2.3

A futura operação deve tratar exatamente os nove paths legados definidos em `design.md`.

**Critérios de aceite**

- Path ausente resulta em `NO_ACTION`.
- Conteúdo byte a byte igual ao baseline v2.3 é elegível a backup e retirada autorizada.
- Conteúdo divergente, symlink, tipo inesperado, versão desconhecida ou unmanaged bloqueia e é preservado.
- Não são criados alias, stub ou redirect.
- Diretórios compartilhados e arquivos extras são preservados.

### REQ-013 — Self-update final e restart obrigatório

A Skill `workflow-bootstrap` deve consumir o manifest/plano, deixar de inferir o mapa de paths, atualizar sua própria `SKILL.md` por último e encerrar imediatamente com `RESTART_REQUIRED`.

**Critérios de aceite**

- Após confirmação do self-update não ocorre escrita em arquivo, journal, receipt ou evidência na Etapa A.
- O receipt pré-restart marca self-update como pendente, sem antecipar sucesso.
- Não ocorre chamada automática da Etapa B.
- Teste com escrita injetada após self-update falha.

### REQ-014 — Etapa B pós-restart separada

A validação global deve ocorrer em nova execução, após restart real, e reconciliar o self-update antes de concluir o receipt.

**Critérios de aceite**

- A execução comprova Skill v3 carregada, 64/64 destinos, hashes/metadados, referências, steering e dez Skills carregáveis.
- A execução comprova ausência dos nove steering e de mixed authority.
- Segundo planejamento retorna 64 `NO_CHANGE` e zero mutação.
- Receipt final só é concluído após observar o self-update real.
- Falha em qualquer critério impede status de instalação concluída.

### REQ-015 — Rollback limitado e independente de Git

O sistema deve derivar rollback do backup manifest, journal e estado real, sem depender de Git.

**Critérios de aceite**

- Somente paths atribuídos ao operation ID podem ser restaurados.
- Before/after hash é comparado antes da restauração.
- Bytes e metadados capturados são restauráveis.
- Arquivo novo só pode ser removido se o pre-state era `ABSENT` e o conteúdo atual ainda é o aplicado.
- Unmanaged e diretórios compartilhados não são removidos.
- Rollback real exige autorização e receipt próprios.

### REQ-016 — Falha parcial e retomada segura

O sistema deve classificar o efeito parcial antes de retry, resume ou rollback.

**Critérios de aceite**

- `KNOWN_RECOVERABLE` permite resume somente após reconciliação de fonte, destino, backup, journal e receipt.
- `UNKNOWN` ou timeout com efeito incerto bloqueia sem retry cego.
- Resume recompõe o plano do estado real, sem confiar apenas no cursor salvo.
- Mudança no snapshot ou na autorização impede continuação.
- Falha confirmada no self-update exige restart/reconciliação e nunca continuação na mesma execução.

### REQ-017 — Gates para adapters e piloto

A distribuição global desta entrega deve ser exclusiva do adapter Kiro. ChatGPT, Codex e Claude ficam fora do lote.

**Critérios de aceite**

- Validator rejeita destino global de adapter diferente de Kiro.
- A implementação não altera ChatGPT Project nem `.agentic` de projeto.
- O piloto `AgenticDevOps` só pode ser proposto após Etapa B aprovada e mediante autorização própria `PROJECT_UPDATE`.
- Merge, release, deploy e piloto não são incluídos nas tasks de implementação local.

### REQ-018 — Preservação e regressão do framework

A mudança deve preservar o core tool-neutral, o lifecycle de `DiscoveryRouter.md`, as referências necessárias às Skills, os comandos oficiais e a reprodutibilidade do pacote.

**Critérios de aceite**

- `npm run validate` e `npm test` aprovam após a futura implementação.
- `framework.lock` cobre todas as fontes e não possui drift/unlocked files.
- O pacote oficial contém manifest, schema, gerados e tooling esperados e é reproduzível pelo processo contratado.
- `Kiro_v2_3_source/`, `Kiro_v2_4_source/`, `Analise_Workflow_v3.0.md` e `.kiro/specs/framework-v3/**` permanecem inalterados.
- Nenhuma dependência nova é adicionada sem replanejamento e autorização.

## Requisitos de segurança

### SEC-001 — Containment de paths

Todo source, destination, backup e artefato operacional deve ser normalizado, resolvido e contido em sua raiz autorizada. Path absoluto indevido, `..`, escape ou raiz ambígua bloqueia antes de mutação.

### SEC-002 — Symlink e tipo de arquivo

O sistema deve usar inspeção no-follow (`lstat` ou equivalente), rejeitar symlink inesperado em arquivo ou ancestral e bloquear tipo diferente do contrato.

### SEC-003 — Cadeia de integridade

Package, lock, manifest, source, generated payload e destination esperado devem ser verificáveis por hash. Divergência interrompe o fluxo e produz zero escrita adicional.

### SEC-004 — Preservação de unmanaged

Arquivo sem provenance gerenciada nunca pode ser sobrescrito, removido, incluído em backup como se fosse gerenciado ou absorvido silenciosamente.

### SEC-005 — Backup antes de mutação destrutiva

Substituição ou retirada exige backup íntegro e restaurável verificado antes da primeira mutação correspondente.

### SEC-006 — Evidência fiel

Journal e receipt não podem registrar intenção como execução nem armazenar segredo, credencial, payload sensível ou path externo não necessário.

### SEC-007 — Allowlist de distribuição

Somente o mapa Kiro de 64 itens pode alcançar destino global. Novos manifest, schemas, planners, validators, templates de controle, testes e fixtures permanecem SOURCE_ONLY/BUILD_TEST_ONLY.

Os 25 arquivos preexistentes de `contracts/**` continuam entre os 63 aprovados conforme REQ-001; essa preservação não autoriza novos artefatos de control plane no global.

### SEC-008 — Diretórios e metadados seguros

Diretórios devem ser criados com permissão restrita contratada, sem elevação de privilégio, e nunca removidos quando compartilhados ou contendo unmanaged.

### SEC-009 — Negação por padrão e retry controlado

Estado desconhecido, permissão insuficiente, perda de observabilidade, efeito parcial incerto ou mudança de ambiente/autorização deve bloquear. Escrita não idempotente ou remota não pode ser repetida automaticamente.

## Requisitos não funcionais

### NFR-001 — Determinismo e reprodutibilidade

Mesmas fontes, manifest e snapshot devem produzir os mesmos gerados, validação, classificação, plano e hashes, desconsiderando apenas campos operacionais explicitamente não determinísticos.

### NFR-002 — Idempotência

Depois de Etapa B aprovada, nova execução deve observar 64 `NO_CHANGE`, zero backup novo, zero self-update, zero alteração de timestamp/metadado e zero mutação.

### NFR-003 — Portabilidade controlada

Tooling deve usar JavaScript ESM em Node.js 24.x, com semântica nativa de Linux e Windows, roots/filesystem injetáveis e sem instalar runtime automaticamente.

## Compatibilidade

### COMP-001 — Lifecycle e autoridade

`DiscoveryRouter.md` mantém seu lifecycle v3.0/v3.1/v3.2 e não substitui o steering global. `.agentic` continua raiz canônica de projeto; `.kiro` de projeto continua compatibilidade não normativa. Os nove steering v2.3 não coexistem com uma instalação v3 declarada validada.

## Requisitos operacionais e de autorização

### OPS-001 — Implementação local sem operação global

Execução do contrato final pode alterar somente arquivos locais autorizados em `framework/**`, testes correspondentes e evidência da execução. Toda validação de filesystem usa roots temporárias sintéticas.

É proibido na execução local:

- escrever em `/home/villas/.kiro/**`;
- criar backup/receipt real;
- retirar ou restaurar legado global;
- reiniciar Kiro;
- executar Etapa A ou B reais;
- migrar o piloto;
- executar Git ou remoto sem autorização própria.

### OPS-002 — Autorizações separadas

Autorização de Spec, Contract Review ou implementação local não autoriza instalação global. Etapa A, restart, Etapa B, piloto, rollback real, Git, publicação, release e deploy permanecem operações semanticamente distintas, com checkpoints e autorizações próprias.

## Erros e estados vazios

- Manifest ausente/inválido: `BLOCKED`, sem inferência de paths.
- Catálogo ou mapa incompleto: `BLOCKED`.
- Nenhuma mutação necessária: plano válido com 64 `NO_CHANGE`.
- Node/npm inadequados: `NEEDS_STATE_VALIDATION`.
- Conflito gerenciado ou legado: `BLOCKED`, preservando o estado.
- Efeito parcial conhecido: `PARTIAL`/`KNOWN_RECOVERABLE`, sem retry automático.
- Efeito parcial desconhecido: `BLOCKED`.
- Self-update confirmado: `RESTART_REQUIRED` e encerramento imediato.

## Observabilidade e evidência

A implementação local deve demonstrar, em roots sintéticas:

- manifest/schema/catálogo validados;
- mapa exato 64 e nove retirements;
- steering determinístico;
- planner sem mutação;
- classificação de todos os estados;
- backup/journal/receipt coerentes;
- apply, falhas injetadas, resume e rollback;
- self-update final e hard stop;
- idempotência;
- regressão de validators, Skills, compatibility, lock e pacote.

A operação futura deve distinguir `planejado`, `executado`, `verificado`, `não executado`, `pendente`, `falha parcial` e `bloqueado`.

## Fora do escopo

- instalação ou alteração global real;
- backup, retirada, restauração ou rollback reais;
- restart e runtime pós-restart nesta entrega local;
- ativação de ChatGPT/Codex/Claude;
- piloto `PROJECT_UPDATE`;
- alteração de arquitetura do core não necessária ao contrato;
- migração de schemas/dados externos;
- Git, PR, merge, branch deletion, release ou deploy.

## Estratégia de validação

1. Validação de schema e semântica do manifest.
2. Testes unitários dos geradores, catálogo, planner e estados.
3. Testes de integração em roots sintéticas Linux/Windows, incluindo casos negativos.
4. Falhas injetadas antes/depois de cada classe de escrita.
5. Regressão via comandos oficiais do projeto.
6. Verificação do lock e do pacote.
7. Validação independente da entrega local.
8. Runtime global somente em Etapa B futura e separadamente autorizada.

## Riscos residuais

- O loader real só pode ser comprovado definitivamente na futura Etapa B; até lá, testes de layout são evidência local/sintética.
- Metadados Windows dependem de capacidades do host e devem ser reportados sem simular semântica POSIX inexistente.
- Self-update permanece o ponto de maior fragilidade operacional; o hard stop e a reconciliação pós-restart reduzem, mas não eliminam, o risco.
- Rollback real continua operação de alto risco e não deve ser acionado automaticamente.

## Itens a confirmar

Nenhuma decisão material aberta. Nomes finais de schemas/templates operacionais e assinaturas internas podem ser refinados pelo Contract Review somente se preservarem IDs, comportamento, mapa 64, boundaries, segurança e limites de autorização.
