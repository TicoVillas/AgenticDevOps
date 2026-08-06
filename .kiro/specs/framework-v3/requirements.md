# Requirements — Framework v3.0

## Identificação

- **Status:** FINAL
- **Fase:** spec
- **Modo:** AUTHOR
- **Estratégia:** Requirements-First
- **Projeto:** AgenticDevOps
- **Slug:** framework-v3
- **Origem:** `discovery.md` `APPROVED_FOR_SPEC`
- **Linha de sessão:** engenharia e autoria
- **Sessão:** `engineering-author/framework-v3`
- **Assurance desta entrega:** HIGH_RISK
- **Última atualização:** 2026-07-28

## Objetivo

Criar a arquitetura 3.0 do framework como refatoração estrutural tool-neutral, preservando o comportamento consolidado da v2.4, reduzindo duplicação documental e tornando políticas, artefatos, transições, dry-runs e evidências verificáveis por máquina.

## Atores e fluxos

- **CONSULTING:** discovery high level, alinhamento, decisões e roteamento; preferência ChatGPT.
- **ENGINEERING:** discovery técnico, Spec, implementação, correção e closeout; preferência Codex.
- **CONTRACT_ASSURANCE:** Contract Review independente; preferência Claude.
- **DELIVERY_ASSURANCE:** validação/revalidação independente; preferência Claude.
- **Kiro:** superfície opcional, sempre com agente `Default`; não define fases.

Fluxo preservado:

```text
discovery high level
→ low-level discovery
→ alinhamento
→ quick-spec | spec | bug-fix
→ contract review ou lint LIGHT permitido
→ execução
→ validação independente
→ correção/revalidação quando necessária
→ revisão final
→ delivery closeout autorizado
```

## Requisitos funcionais

### Core, papéis e roteamento

- **REQ-001 — Core tool-neutral:** a distribuição v3.0 deve definir fases, estados, papéis, transições, guardas, artefatos e requisitos de sessão sem depender de Kiro, ChatGPT, Codex, Claude ou nome de modelo.
- **REQ-002 — Máquina de estados:** `core/workflow.yaml` deve representar todas as fases, estados válidos, entradas, saídas, transições e condições de interrupção, com validação automatizada.
- **REQ-003 — Descrição humana:** `core/workflow-core.md` deve ser uma visão humana concisa e consistente com `workflow.yaml`; divergência deve falhar na validação.
- **REQ-004 — Papéis abstratos:** `core/roles.yaml` deve definir `CONSULTING`, `ENGINEERING`, `CONTRACT_ASSURANCE` e `DELIVERY_ASSURANCE`, inclusive regras de independência e continuidade.
- **REQ-005 — Status canônicos:** `core/statuses.yaml` deve ser a fonte dos status permitidos por fase e impedir status desconhecido ou transição inválida.
- **REQ-006 — Router reduzido:** `core/WorkflowRouter.md` deve limitar-se a classificar estado, próxima fase, sessão, decisão, assurance e status, referenciando o core e sem reproduzir Skills/políticas.

### Políticas, contratos e Skills

- **REQ-007 — Separação de responsabilidades:** controles, políticas, contratos, Skills e adapters devem possuir ownership inequívoco e não duplicar regras normativas.
- **REQ-008 — Capability selection:** a política deve selecionar capacidade mínima, esforço e fallback; nomes/catálogos de modelos pertencem exclusivamente aos adapters.
- **REQ-009 — Contexto progressivo:** o framework deve carregar metadados, depois a Skill aplicável e somente então referências necessárias, com orçamento de contexto proporcional.
- **REQ-010 — Skill canônica única:** cada Skill deve ter uma única fonte manual em `skills/<slug>/SKILL.md`; formatos alternativos devem ser gerados e validados.
- **REQ-011 — Progressive disclosure da Skill:** cada `SKILL.md` deve conter quando usar, entradas, procedimento, limites, saídas, interrupção e próxima fase; templates, exemplos e detalhes condicionais ficam em `references/`, `scripts/` ou `assets/`.
- **REQ-012 — Tamanho de Skill:** o validator deve advertir quando uma Skill exceder aproximadamente 500 linhas e falhar quando conteúdo normativo duplicado puder ser referenciado.
- **REQ-013 — Schemas e templates:** formatos de artefatos, findings, evidências, perfis e manifestos devem residir em `contracts/schemas/` e `contracts/templates/`, não integralmente nas Skills.
- **REQ-014 — Lock de distribuição:** `framework.lock` deve registrar versões e hashes de fontes canônicas e artefatos gerados, detectando drift.

### Raiz de projeto e compatibilidade

- **REQ-015 — Raiz tool-neutral:** `.agentic/` deve ser a raiz canônica futura de configuração e artefatos do projeto.
- **REQ-016 — Compatibilidade Kiro:** `.kiro/` deve permanecer como camada temporária do adapter Kiro, sem virar segunda fonte normativa.
- **REQ-017 — Alias de router:** v3.0 mantém `DiscoveryRouter.md` como alias gerado com warning; v3.1 exige migração das referências; v3.2 permite remoção somente sem qualquer referência ou consumidor legado.
- **REQ-018 — Compatibilidade comportamental:** a migração deve preservar as fases, gates, autorizações separadas, continuidade de autoria e independência inicial existentes na v2.4.

### Perfil técnico e assurance

- **REQ-019 — Schema de perfil:** `contracts/schemas/application-profile.schema.yaml` deve validar o perfil técnico da aplicação.
- **REQ-020 — Instância do projeto:** `.agentic/application-profile.yaml` deve ser a instância canônica por projeto.
- **REQ-021 — Override excepcional:** `.agentic/specs/<slug>/application-profile.override.yaml` só pode existir para exceção material autorizada e deve conter, no mínimo, `scope`, `rationale`, `authorization_ref`, `authorized_at`, `expires_at`, `base_profile_hash` e `source_evidence`. O validator deve operar fail-closed e rejeitar override sem autorização, escopo, racional ou expiração válidos, bem como hash-base divergente ou evidência de origem ausente.
- **REQ-022 — Exposição independente:** o perfil deve aceitar somente `LOCAL_ISOLATED`, `INTERNAL_RESTRICTED`, `EXTERNAL_RESTRICTED` ou `PUBLIC`.
- **REQ-023 — Impacto independente:** o perfil deve aceitar somente `LOW`, `MODERATE`, `HIGH` ou `CRITICAL`.
- **REQ-024 — Combinação objetiva:** exposição e impacto devem gerar controles por regras explícitas; rede interna nunca concede confiança implícita.
- **REQ-025 — Baseline permanente:** toda entrega deve aplicar controles baseline realmente relevantes, incluindo fronteiras, menor privilégio, segredos, erros/defaults seguros, dados/dependências/logs, diff/escopo e testes negativos aplicáveis.
- **REQ-026 — Assurance LIGHT:** `LIGHT` só é elegível para Quick Spec pequena, local, reversível e de baixo risco; substitui Contract Review independente por lint estrutural automatizado e preserva validação independente.
- **REQ-027 — Escala automática:** finding material ou falha de guarda em `LIGHT` deve elevar a entrega para `STANDARD` antes de execução.
- **REQ-028 — Assurance padrão:** `STANDARD` deve ser o default e manter Contract Review e validação independentes.
- **REQ-029 — Assurance HIGH_RISK:** `HIGH_RISK` deve reforçar review, validação, evidência, critérios de interrupção e checkpoints.
- **REQ-030 — Proporcionalidade bidirecional:** Contract Review e validação devem identificar controles insuficientes e controles excessivos sem benefício material.

### Dry-runs e checkpoints

- **REQ-031 — Classificação de dry-run:** dry-runs devem ser classificados por risco, reversibilidade, ambiguidade e blast radius.
- **REQ-032 — Manifesto de dry-run:** `dry-run-manifest.yaml` deve registrar operação, alvo, ambiente, autorização, escopo/hashes, mutação, determinismo, idempotência, equivalência, precondições, efeitos, limites, rollback, interrupção, evidências e decisão.
- **REQ-033 — Autoaplicação segura:** somente dry-run `AUTO_APPLY_ELIGIBLE`, determinístico e com todas as guardas aprovadas pode ser aplicado automaticamente.
- **REQ-034 — Checkpoint obrigatório:** escrita externa/remota, ambiente compartilhado/produção, dados/schema/permissão/segurança/infraestrutura, baixa reversibilidade, alto blast radius, ambiguidade, decisão material ou equivalência incompleta devem resultar em `CHECKPOINT_REQUIRED`.
- **REQ-035 — Bloqueio fail-closed:** autorização ausente, divergência de escopo/hash/snapshot, efeito parcial desconhecido ou evidência/rollback/observabilidade obrigatórios ausentes devem resultar em `BLOCKED`.
- **REQ-036 — Não concessão de autoridade:** auto-validação ou dry-run nunca pode criar ou ampliar autorização.

### Chaining e sessões

- **REQ-037 — Manifesto de transição:** `transition-manifest.yaml` deve registrar fases, Skills, autorização, hashes, guardas, sessão/linha, requisito de independência, decisão, evidências e ações não executadas.
- **REQ-038 — Envelope comum:** os dois manifestos devem reutilizar `contracts/schemas/evidence-envelope.schema.yaml`.
- **REQ-039 — Guardas obrigatórias:** chaining exige autorização explícita da próxima fase, artefato finalizado, hashes compatíveis, ausência de decisão pendente, evidência suficiente e topologia correta.
- **REQ-040 — Allowlist inicial:** somente as edges confirmadas no discovery podem encadear; qualquer nova edge exige decisão arquitetural e atualização versionada do core.
- **REQ-041 — Cross-session routing:** primeiro Contract Review e primeira validação devem criar sessão independente; chaining não pode reutilizar autor/executor como assurance.
- **REQ-042 — Continuidade correta:** rework retorna ao autor, follow-up ao reviewer original, correção ao executor e revalidação ao validator original.
- **REQ-043 — Não escalada por chaining:** chaining não pode ampliar escopo, paths, permissões, risco aceito, Git/remoto ou autorização.

### Adapters e respostas

- **REQ-044 — Adapters isolados:** adapters de ChatGPT, Codex, Claude e Kiro devem mapear capacidades, formato e superfície sem alterar a semântica do core.
- **REQ-045 — Perfis ChatGPT:** o adapter ChatGPT deve oferecer `DELTA`, `DECISION`, `HANDOFF`, `REVIEW`, `RESEARCH` e `FULL_ARTIFACT`; `DELTA` é o padrão.
- **REQ-046 — Budgets flexíveis:** defaults: `DELTA` ≈300 palavras; `HANDOFF` com preâmbulo de até quatro linhas e instrução ≈30 linhas; `REVIEW` limitado a decisão, findings, evidência faltante e próxima fase.
- **REQ-047 — Não duplicação de resposta:** uma informação deve aparecer uma única vez entre preâmbulo, análise, conclusão e handoff.
- **REQ-048 — Adapter Kiro:** Kiro deve usar somente agente `Default`; Spec, Quick Spec e demais fases continuam sendo Skills portáveis.

### Decision Records, validação e migração

- **REQ-049 — Decision Records:** decisões arquiteturais permanentes devem ser versionadas, incluindo topologia de sessões, Autopilot padrão, papéis e core tool-neutral.
- **REQ-050 — Validadores:** a distribuição deve fornecer validadores de workflow, artefatos, Skills, duplicação, adapters, fontes, handoff, perfil, dry-run e transição.
- **REQ-051 — Evals comportamentais:** cenários devem cobrir roteamento, assurance, perfis de aplicação, dry-run, chaining, independência, continuidade, economia de resposta e Kiro Default.
- **REQ-052 — Métrica de handoff:** testes comparativos devem demonstrar redução de handoffs somente onde não existe decisão humana material, com zero autorização inferida, zero violação de topologia e zero bypass de checkpoint.
- **REQ-053 — Construção paralela:** a v3.0 deve ser criada em estrutura paralela, mantendo v2.3, v2.4 e a análise v3.0 somente leitura durante implementação.
- **REQ-054 — Operação separada:** construir, validar ou empacotar v3.0 não autoriza instalar globalmente, migrar projeto, remover aliases, publicar, fazer Git remoto, release ou deploy.

## Requisitos não funcionais

- **NFR-001 — Determinismo:** validadores devem produzir o mesmo resultado para entradas e versões idênticas.
- **NFR-002 — Fail-closed:** schema inválido, referência quebrada, hash divergente ou decisão ausente deve impedir transição material.
- **NFR-003 — Portabilidade:** core, políticas, contratos e Skills não podem exigir uma ferramenta específica.
- **NFR-004 — Auditabilidade:** decisões, autorizações, evidências, hashes e transições devem ser rastreáveis sem reconstruir conversas.
- **NFR-005 — Concisão:** documentos não devem repetir conteúdo cuja fonte canônica possa ser referenciada.
- **NFR-006 — Sanitização:** schemas, manifests, logs e evidências não podem armazenar segredos ou dados pessoais desnecessários.
- **NFR-007 — Compatibilidade:** aliases e gerados devem emitir warning sem alterar o comportamento canônico.

## Regras de negócio

- **BR-001:** autorização pertence à operação/fase atual e não ao modelo, modo, sessão ou Skill.
- **BR-002:** Autopilot é padrão quando não houver intervenção humana pendente; não amplia autoridade.
- **BR-003:** continuidade é usada para produção; independência inicial é obrigatória para assurance.
- **BR-004:** o artefato canônico e o estado real prevalecem sobre memória de sessão.
- **BR-005:** mudança material interrompe a fase e retorna ao ponto de decisão adequado.
- **BR-006:** `.kiro/` é compatibilidade de adapter, não raiz normativa v3.0.

## Segurança

- Validação de schemas e argumentos deve ocorrer antes de qualquer ação material.
- Conteúdo remoto, saída de modelo, adapter e ferramenta são não confiáveis até validação.
- Guardas devem aplicar menor privilégio, contenção de paths e negação por padrão.
- Operações remotas e de alto risco permanecem separadas e sujeitas a autorização/checkpoint.
- Evidence envelope deve permitir sanitização e classificação da força/origem da evidência.

## Compatibilidade, migração e rollout

- v3.0 introduz a nova estrutura em paralelo, aliases com warning e adapters compatíveis.
- v3.1 exige migração das referências restantes e bloqueia novos consumidores legados.
- v3.2 torna aliases elegíveis para remoção, condicionada a varredura sem referências/consumidores.
- Instalação global e migração de projetos são operações futuras separadas, com dry-run, backup, rollback e autorização própria.

## Fora do escopo

- Modificar v2.3, v2.4 ou `Analise_Workflow_v3.0.md`.
- Implementar produto ou aplicação consumidora.
- Executar instalação global, migração real, Git, push, PR, merge, release ou deploy nesta fase.
- Fixar permanentemente marcas/modelos no core.
- Remover compatibilidade antes das condições v3.2.

## Critérios de aceite

- **ACC-001:** schemas validam todos os artefatos estruturados válidos e rejeitam fixtures inválidas relevantes.
- **ACC-002:** busca automatizada não encontra nomes de ferramentas/modelos fora de adapters, compatibilidade documentada ou exemplos permitidos.
- **ACC-003:** cada Skill possui uma fonte manual; cópia gerada divergente falha.
- **ACC-004:** workflow e router aceitam todas as transições canônicas e rejeitam edges não permitidas.
- **ACC-005:** os 16 pares de exposição × impacto produzem classificação objetiva e testada, sem confiança implícita em rede interna.
- **ACC-006:** `LIGHT` aceita somente Quick Spec elegível e escala para `STANDARD` diante de finding material/guarda falha.
- **ACC-007:** dry-run seguro passa; divergência de hash/path, escrita externa ou alto risco não autoaplica.
- **ACC-008:** chaining autorizado reduz handoff sem ampliar autoridade; primeiro review/validation continuam cross-session.
- **ACC-009:** perfis ChatGPT obedecem defaults flexíveis e não duplicam informação.
- **ACC-010:** aliases cumprem lifecycle e não são removidos com consumidor legado.
- **ACC-011:** Decision Records iniciais existem, são versionados e referenciados sem duplicar políticas.
- **ACC-012:** matriz de equivalência demonstra preservação do comportamento v2.4.
- **ACC-013:** nenhuma fonte v2.3/v2.4 é alterada durante a implementação.
- **ACC-014:** operações reais permanecem não executadas e explicitamente separadas.
- **ACC-015 — Capability selection tool-neutral (REQ-008):** teste de contrato prova que o core e a política expressam somente capacidades, esforço e fallback, sem catálogo ou nome concreto de modelo; fixture com nome concreto fora de `adapters/` falha, e os nomes permitidos são resolvidos exclusivamente pelos adapters.
- **ACC-016 — Contexto progressivo (REQ-009):** teste instrumentado prova a sequência `metadados → Skill aplicável → referências necessárias` e falha se uma referência não solicitada for carregada.

## Estratégia de validação

- Validação de schema com fixtures positivas e negativas, incluindo overrides com os sete campos obrigatórios e rejeição fail-closed de autorização, escopo, racional, expiração, hash-base ou evidência inválidos/ausentes.
- Testes unitários dos guardas e classificadores.
- Teste de contrato dedicado a REQ-008/ACC-015 para proibir catálogo/nome concreto de modelo no core e confirmar resolução exclusiva nos adapters.
- Teste instrumentado dedicado a REQ-009/ACC-016 para provar `metadados → Skill aplicável → referências necessárias`, sem carregamento de referência não solicitada.
- Testes de contrato entre core e adapters.
- Evals de cenários e snapshots de handoff/resposta.
- Varredura de duplicação e dependência de ferramenta.
- Matriz de equivalência v2.4 → v3.0.
- Validação independente em sessão distinta após execução.

## Riscos

- A refatoração pode alterar semântica ao remover duplicação.
- Geradores podem criar nova fonte implícita se não forem determinísticos.
- Perfis objetivos podem ser calibrados incorretamente.
- Chaining permissivo pode violar autoridade ou independência.
- Compatibilidade prolongada pode perpetuar dívida.
- Blast radius é alto por afetar todos os projetos preparados.

## Itens a confirmar

Nenhuma decisão material pendente para Contract Review. O destino local da implementação é `/home/villas/Projects/AgenticDevOps/framework/`; instalação e empacotamento fora desse path permanecem operações futuras não autorizadas.