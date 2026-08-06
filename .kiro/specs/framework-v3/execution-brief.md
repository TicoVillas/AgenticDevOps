# Execution Brief — Framework v3.0

## Identificação

- **Status:** FINAL_READY_FOR_EXECUTION
- **Fase:** spec
- **Modo da Spec:** REWORK_AFTER_CONTRACT_REVIEW
- **Estratégia:** Requirements-First
- **Projeto:** AgenticDevOps
- **Slug:** framework-v3
- **Linha de sessão:** engenharia e autoria
- **Sessão:** `engineering-author/framework-v3`
- **Assurance:** HIGH_RISK
- **Última atualização:** 2026-07-28

## Estado do contrato

Contrato consolidado como FINAL pelo Contract Review round-02 (FOLLOW_UP), decisão vigente `APPROVED`. CR-001–CR-004 estão `RESOLVED` com evidência e CR-005 permanece `ACCEPTED_WARNING`. Este brief está `FINAL_READY_FOR_EXECUTION`. **A implementação continua não autorizada**: exige autorização explícita e separada do usuário; a aprovação do review não a infere.

## Artefatos de referência

- `discovery.md` — `APPROVED_FOR_SPEC`
- `requirements.md` — `FINAL`
- `design.md` — `FINAL`
- `tasks.md` — `FINAL`
- `reviews/contract-review.md` — decisão vigente `APPROVED`; CR-001–CR-004 `RESOLVED`, CR-005 `ACCEPTED_WARNING`

## Objetivo

Criar a distribuição v3.0 tool-neutral em estrutura paralela, preservando o comportamento v2.4, com fontes normativas únicas, Skills progressivas, contratos/schemas verificáveis, segurança proporcional, dry-run fail-closed, chaining autorizado e adapters isolados.

## Norte técnico

```text
preflight Node.js 24.x + npm
→ core declarativo
→ contratos e schemas
→ políticas com ownership único
→ perfil/assurance e demais classificadores consumidores
→ Skills canônicas e conteúdo sob demanda
→ adapters sem autoridade sobre o core
→ validação automatizada e fail-closed
→ compatibilidade temporária gerada
→ equivalência v2.4 comprovada
```

Toolchain vinculante das ferramentas:

- Node.js 24.x e JavaScript ESM, sem TypeScript/transpilação;
- npm com `framework/package.json` e `framework/package-lock.json`;
- dependências locais mínimas `ajv`, `ajv-formats` e `yaml`, pinadas exatamente;
- instalação futura somente por `npm ci --ignore-scripts`, sem instalação global;
- comandos oficiais `npm run validate` e `npm test`;
- `node:test`, `node:crypto`, `node:fs` e `node:path` para testes, hashes, filesystem e contenção de paths;
- core, schemas, contratos, políticas e Skills permanecem tool-neutral.

## Tarefas autorizáveis após aprovação

O Contract Review deve confirmar ou ajustar a autorização das Tarefas 1–10 de `tasks.md`:

1. core e máquina de estados;
2. contratos e schemas;
3. políticas com fonte única;
4. perfil técnico e assurance;
5. dry-run fail-closed;
6. chaining e topologia;
7. Skills;
8. adapters;
9. Decision Records e compatibilidade;
10. evals, equivalência e pacote local não instalado.

## Tarefas não autorizadas

- Modificar `Kiro_v2_3_source/`, `Kiro_v2_4_source/` ou `Analise_Workflow_v3.0.md`.
- Instalar ou atualizar framework global.
- Migrar projeto real para `.agentic/`.
- Remover `.kiro/` ou aliases legados.
- Fazer Git, staging, commit, push, PR, merge ou exclusão de branch.
- Publicar pacote, tag, release ou deploy.
- Executar produção, infraestrutura, migração de dados ou escrita externa.
- Usar runtime diferente de Node.js 24.x ou adicionar dependência material além de `ajv`, `ajv-formats` e `yaml` sem decisão e revisão do contrato.

## Decisões vinculantes

- Core define papéis abstratos e semântica; adapters mapeiam ferramentas.
- ChatGPT/CONSULTING, Codex/ENGINEERING, Claude/assurance são defaults, não dependências do core.
- Kiro é superfície opcional sempre com agente `Default`.
- `.agentic/` é a raiz futura tool-neutral; `.kiro/` é compatibilidade temporária.
- Exposição e impacto são independentes e combinados objetivamente.
- `STANDARD` é o default; `LIGHT` preserva validação independente; `HIGH_RISK` reforça assurance.
- Dry-run e transition manifests permanecem separados e compartilham evidence envelope.
- Chaining usa allowlist e nunca cria autorização.
- Primeiras revisão/validação são cross-session; follow-ups retomam sessões originais.
- Aliases seguem lifecycle v3.0/v3.1/v3.2 e não são removidos com consumidor legado.
- Adapter ChatGPT usa `DELTA` como perfil padrão e proíbe repetição entre seções.
- Decisões arquiteturais permanentes usam Decision Records versionados.
- Capability selection no core/política expressa somente capacidades, esforço e fallback; catálogo e nomes concretos existem somente nos adapters.
- Contexto é carregado em `metadados → Skill aplicável → referências necessárias`, sem referências não solicitadas.
- Override do perfil exige `scope`, `rationale`, `authorization_ref`, `authorized_at`, `expires_at`, `base_profile_hash` e `source_evidence`, com validação fail-closed.
- A revisão final `CONSULTING` e a entrada autorizada no delivery closeout permanecem no fluxo completo como transições humanas, não edges automáticas.

## Áreas e arquivos principais

### Principais

- `framework/package.json`
- `framework/package-lock.json`
- `framework/core/**`
- `framework/policies/**`
- `framework/contracts/**`
- `framework/skills/**`
- `framework/adapters/**`
- `framework/decisions/**`
- `framework/tools/**`
- `framework/tests/**`
- `framework/framework.lock`

### Condicionais

- `.agentic/**` apenas para fixtures/estrutura de projeto dentro da raiz de teste autorizada; nenhuma migração real.
- `.kiro/**` apenas para adapter/fixtures de compatibilidade, sem alterar os artefatos canônicos desta entrega durante implementação.

### Proibidas

- `Kiro_v2_3_source/**`
- `Kiro_v2_4_source/**`
- `Analise_Workflow_v3.0.md`
- instalação global e qualquer path fora da allowlist confirmada no preflight.

O destino autorizado para futura implementação local é `/home/villas/Projects/AgenticDevOps/framework/`. Qualquer destino diferente amplia o escopo e requer autorização própria.

## Comportamentos preservados

- Gate de alinhamento entre discovery técnico e Spec.
- Quick Spec, Spec e Bug Fix como Skills distintas.
- Contract Review e validação independentes conforme assurance.
- Continuidade da autoria e retorno ao reviewer/validator original.
- Artefato vigente e estado real acima de memória/relato.
- Autorizações separadas para planejar, implementar, corrigir e operar Git/remoto.
- Autopilot como padrão sem ampliação de autoridade.
- Segurança transversal e overlay de alto risco.
- Um escritor por working tree e preservação de alterações preexistentes.

## Segurança

- Validar todo conteúdo que cruza boundary de usuário, modelo, adapter, ferramenta, arquivo, shell ou remoto.
- Aplicar contenção de path, menor privilégio e negação por padrão.
- Não armazenar segredo em schemas, fixtures, manifests, logs ou evidências.
- Tratar saída de modelo e conteúdo recuperado como não confiáveis.
- Testar guardas positivas e negativas, inclusive autorização, hash, path, sessão e efeito parcial.
- Detectar controles insuficientes e excessivos em relação ao perfil.

## Alto risco

A entrega tem alto blast radius porque altera o framework usado por múltiplos projetos. A execução autorizada deve permanecer local e paralela. Operações globais/reais ficam separadas.

Controles obrigatórios:

- preflight de raiz, writer, paths, alterações preexistentes, Node major 24 e npm;
- ausência de Node major 24/npm encerra `NEEDS_STATE_VALIDATION`, sem instalação ou atualização automática;
- matriz de equivalência v2.4→v3.0;
- dry-run para geração/empacotamento;
- geradores determinísticos e idempotentes;
- hashes e `framework.lock`;
- rollback técnico limitado ao delta v3 paralelo;
- critérios de interrupção e evidência por tarefa;
- Contract Review e validação independentes reforçados.

## Validações obrigatórias

- Schemas e fixtures positivas/negativas, incluindo os sete campos do override e rejeição de autorização, escopo, racional ou expiração inválidos.
- Workflow reachability, status e transições.
- Teste dedicado REQ-008/ACC-015: core/política sem catálogo ou nome concreto; resolução exclusiva nos adapters.
- Teste dedicado REQ-009/ACC-016: trace `metadados → Skill → referências necessárias`, sem referência não solicitada.
- Matriz 4×4 de exposição×impacto.
- Assurance e elevação LIGHT→STANDARD.
- Dry-run e chaining fail-closed.
- Topologia de sessões e cross-session routing.
- Fonte única/geração das dez Skills.
- Tool coupling restrito aos adapters.
- Perfis ChatGPT, budgets flexíveis e não duplicação.
- Alias lifecycle e consumidor legado.
- Decision Records e referências.
- Matriz integral requisito→design→task→teste/evidência.
- Equivalência comportamental com v2.4.
- Preservação das três fontes read-only.

## Checkpoints

- **Nova decisão arquitetural ou mudança de escopo:** `REQUIRES_REPLANNING`.
- **Node major 24 ou npm ausente:** `NEEDS_STATE_VALIDATION`, sem instalar/atualizar automaticamente.
- **Runtime diferente ou dependência material adicional:** `REQUIRES_REPLANNING` antes de prosseguir.
- **Path físico fora da allowlist:** autorização própria.
- **Diferença material v2.4→v3.0:** interromper e retornar ao contrato.
- **Instalação global, migração de projeto, remoção de alias, publicação ou remoto:** fase e autorização separadas.
- **Efeito parcial ou estado incerto:** parar, preservar evidência e não repetir cegamente.

Não há checkpoint visual/manual planejado dentro da criação local paralela quando todas as guardas determinísticas passarem.

## Evidências esperadas

- Relatórios dos validators com exit codes.
- Fixtures e resultados de testes/evals.
- Matriz requisito→design→task→teste→evidência.
- Matriz de equivalência v2.4→v3.0.
- Relatórios de duplicação e tool coupling.
- Manifests de dry-run/transição sanitizados.
- `framework.lock` e hashes reproduzíveis.
- Estado inicial/final e diff atribuível.
- `EXECUTION.md` com ações reais não executadas.

## Critérios de interrupção

- Requisito sem design/task/validação.
- Decisão material não coberta pelo discovery.
- Runtime diferente de Node.js 24.x, dependência material adicional ou path material não autorizado.
- Escrita em fonte preservada ou instalação global.
- Falha de schema, hash, guard, equivalência ou topologia.
- Falso `AUTO_APPLY_ELIGIBLE` em cenário crítico.
- Autorização inferida ou checkpoint bypassado.
- Adapter modificando semântica do core.
- Cópia gerada tornando-se fonte manual.
- Segredo ou dado sensível em artefato/evidência.

## Divergências que exigem replanejamento

- Alteração dos enums de exposição/impacto ou perfis de assurance.
- União dos dois manifests ou mudança do evidence envelope.
- Nova edge de chaining.
- Relaxamento de cross-session routing.
- Remoção antecipada de compatibilidade.
- Mudança de papéis, Autopilot padrão ou core tool-neutral.
- Runtime diferente de Node.js 24.x ou dependência material além de `ajv`, `ajv-formats` e `yaml`.
- Operação global/real incorporada à execução local.

## Seleção preliminar da execução

- **Executor:** Kiro, preferência de engenharia Codex
- **Superfície:** IDE ou CLI local confirmada no preflight
- **Família/modelo:** Codex / modelo explícito disponível com capacidade para refatoração longa e ferramentas; seleção final pelo Contract Reviewer
- **Esforço:** High ou equivalente
- **Agente Kiro:** Default
- **Modo:** Autopilot para lotes locais determinísticos; Supervised somente quando houver checkpoint humano pendente
- **Estratégia de sessão:** retomar `engineering-author/framework-v3`
- **Fallback:** modelo Active de capacidade equivalente aprovado; interromper se houver perda material de capacidade

## Ações Git e remotas

Não autorizadas nesta fase nem por este draft. Contract Review aprovado e futura autorização de implementação não autorizam staging, commit, push, PR, merge, release, deploy ou migração.

## Contract Review follow-up

- **Próxima fase:** `contract-review` em modo `FOLLOW_UP`
- **Skill:** `contract-review`
- **Papel:** CONTRACT_ASSURANCE
- **Executor/família:** Claude, preservando a seleção resolvida da rodada inicial
- **Capacidade:** alta confiabilidade, grande contexto, contestação arquitetural e segurança
- **Esforço:** High
- **Modo operacional:** `FOLLOW_UP`
- **Estratégia de sessão:** retomar a sessão revisora original
- **Sessão de destino:** `contract-assurance/framework-v3/round-01`
- **Overlay:** HighRiskOverlay proporcional ao blast radius do framework
- **Fallback:** não substituir silenciosamente; qualquer indisponibilidade material retorna para decisão

## Retorno esperado

O reviewer original deve carregar seu ledger, confrontar o delta de CR-001–CR-004 no estado real e preservar CR-005 como warning aceito, sem implementar. Deve atualizar a decisão vigente no artefato de review; esta sessão autora encerra com os drafts aguardando assurance.