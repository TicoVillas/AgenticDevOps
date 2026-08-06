# Design — Framework v3.0

## Identificação

- **Status:** FINAL
- **Fase:** spec
- **Modo:** AUTHOR
- **Estratégia:** Requirements-First
- **Projeto:** AgenticDevOps
- **Slug:** framework-v3
- **Origem:** `discovery.md` `APPROVED_FOR_SPEC`, `requirements.md` DRAFT
- **Linha de sessão:** engenharia e autoria
- **Assurance:** HIGH_RISK
- **Última atualização:** 2026-07-28

## Estratégia da Spec

Construir uma distribuição v3.0 paralela e tool-neutral, extraindo as responsabilidades consolidadas da v2.4 para fontes canônicas estruturadas. O design privilegia redução e geração: regras aparecem uma vez; documentação humana, aliases e cópias compatíveis são derivados quando possível.

## Estado atual relevante

A v2.4 mantém comportamento forte, mas possui core/router/contratos/Skills extensos, templates embutidos e dez Skills duplicadas em `SkillsUnified/`. Não há máquina de estados, schemas, manifests ou validators estruturados. A v2.3 é somente referência histórica.

## Objetivos de design

- Preservar semântica e topologia do workflow v2.4.
- Separar controle, política, contrato, Skill e adapter.
- Tornar transições e artefatos verificáveis por máquina.
- Reduzir contexto inicial por progressive disclosure.
- Aplicar segurança/assurance proporcionalmente.
- Automatizar somente o que é autorizado, determinístico e seguro.
- Manter compatibilidade temporária sem segunda fonte normativa.

## Arquitetura da solução

Todos os paths abaixo são relativos a `framework`, uma nova raiz paralela a ser delimitada antes da execução. A instalação por projeto usa `.agentic/`; `.kiro/` é somente compatibilidade do adapter Kiro.

```text
framework/
├── package.json
├── package-lock.json
├── core/
│   ├── workflow.yaml
│   ├── workflow-core.md
│   ├── WorkflowRouter.md
│   ├── roles.yaml
│   └── statuses.yaml
├── policies/
│   ├── CapabilitySelectionPolicy.md
│   ├── ContextPolicy.md
│   ├── ExecutionEnvironmentPolicy.md
│   ├── GitSafetyPolicy.md
│   ├── SecureDevelopmentPolicy.md
│   └── HighRiskOverlay.md
├── contracts/
│   ├── ArtifactContract.md
│   ├── EvidenceAndFeedbackContract.md
│   ├── schemas/
│   │   ├── application-profile.schema.yaml
│   │   ├── evidence-envelope.schema.yaml
│   │   ├── dry-run-manifest.schema.yaml
│   │   ├── transition-manifest.schema.yaml
│   │   ├── finding.schema.yaml
│   │   └── artifact schemas
│   └── templates/
├── skills/<slug>/
│   ├── SKILL.md
│   ├── references/
│   ├── scripts/
│   └── assets/
├── adapters/
│   ├── chatgpt/
│   ├── codex/
│   ├── claude/
│   └── kiro/
├── decisions/
├── tests/
│   ├── workflow/
│   ├── policies/
│   ├── contracts/
│   ├── skills/
│   └── scenarios/
├── tools/
└── framework.lock
```

## Toolchain das ferramentas

O runtime de referência dos validadores e geradores é Node.js 24.x, com JavaScript ESM sem TypeScript ou transpilação e npm como package manager. Node permanece confinado às ferramentas: core, schemas, contratos, políticas e Skills são dados/documentos tool-neutral e não importam APIs de Node nem nomes de pacotes.

- Manifests: `framework/package.json` e `framework/package-lock.json`.
- Dependências locais mínimas e pinadas exatamente: `ajv`, `ajv-formats` e `yaml`.
- Instalação futura, somente durante execução autorizada: `npm ci --ignore-scripts`, a partir de `framework/`; nenhuma instalação global.
- Scripts oficiais: `npm run validate` e `npm test`.
- Testes: `node:test`; hashes: `node:crypto`; arquivos e contenção de paths: `node:fs` e `node:path`.
- Preflight: ausência de Node major 24 ou npm produz `NEEDS_STATE_VALIDATION`, sem instalar ou atualizar runtime automaticamente.
- Runtime diferente ou dependência material adicional exige `REQUIRES_REPLANNING`; a toolchain aprovada acima não é pendência.

## Boundaries e ownership

| Boundary | Fonte de verdade | Consumidores | Regra |
|---|---|---|---|
| Estado/transição | `core/workflow.yaml` | router, Skills, validators, adapters | Nenhum consumidor redefine transição. |
| Papéis/sessões | `core/roles.yaml` | workflow, transition validator, adapters | Ferramenta é mapeamento, não papel. |
| Status | `core/statuses.yaml` | artefatos, router, validators | Status desconhecido falha. |
| Política | `policies/*` | Skills, contracts, validators | Skill referencia; não copia. |
| Artefato | schemas + templates | Skills, execução, assurance | Schema governa estrutura; template governa apresentação. |
| Procedimento | `skills/<slug>/SKILL.md` | agentes/adapters | Uma fonte manual por Skill. |
| Ferramenta | `adapters/<tool>/` | runtime específico | Adapter não altera core. |
| Estado de projeto | `.agentic/` | adapters e Skills | `.kiro/` só espelha/encaminha compatibilidade. |

## Core e máquina de estados

### `workflow.yaml`

Cada fase declara:

- `id`, papel, Skill, entradas, saídas e status;
- artefatos requeridos e seus estados;
- paths permitidos;
- assurance mínima e overlays;
- transições de sucesso, rework, findings e bloqueio;
- requisito de autorização;
- requisito de mesma sessão, sessão original ou nova sessão independente;
- guardas de chaining e checkpoints.

A máquina deve conter a allowlist inicial:

```text
workflow-bootstrap → low-level-discovery
low-level-discovery → quick-spec | spec | bug-fix
quick-spec | spec | bug-fix → contract-review
contract-review APPROVED → execute-contract
contract-review REWORK → engineering-author original
execute-contract → validate-delivery
validate-delivery FINDINGS → correct-from-validation
correct-from-validation → delivery-validator original (revalidation)
delivery-closeout → somente passos internos do lote autorizado
```

Primeiro Contract Review e primeira validação usam `cross_session_required: true`. Rework/revalidação usam identidade de sessão original. O fluxo completo preserva ainda a revisão final por `CONSULTING` e a entrada autorizada em `delivery-closeout`; ambas permanecem transições humanas explícitas e não edges automáticas da allowlist inicial.

### `WorkflowRouter.md`

Renderização humana das decisões de roteamento: fase atual, autoridade, artefato vigente, assurance, próxima fase, sessão, decisão e status. Não contém procedimentos de Skills nem contratos completos.

## Perfil técnico da aplicação

### Schema e instâncias

- Schema: `contracts/schemas/application-profile.schema.yaml`.
- Instância do projeto: `.agentic/application-profile.yaml`.
- Override: `.agentic/specs/<slug>/application-profile.override.yaml` somente para exceção material autorizada.

O schema do override exige:

```yaml
scope: []
rationale: ""
authorization_ref: ""
authorized_at: ""
expires_at: ""
base_profile_hash: ""
source_evidence: []
```

`scope` deve ser delimitado e não vazio; `rationale` deve justificar a exceção; `authorization_ref` deve apontar para autorização válida; `authorized_at` e `expires_at` devem ser timestamps válidos, com expiração posterior à autorização e ainda vigente; `base_profile_hash` deve corresponder ao perfil-base; `source_evidence` deve ser não vazio e rastreável. O validator rejeita fail-closed autorização, escopo, racional ou expiração ausentes/inválidos e também hash-base divergente ou evidência ausente.

Campos centrais do perfil-base:

```yaml
version: 1
exposure: LOCAL_ISOLATED | INTERNAL_RESTRICTED | EXTERNAL_RESTRICTED | PUBLIC
impact: LOW | MODERATE | HIGH | CRITICAL
context:
  environments: []
  identities: []
  data_classes: []
  integrations: []
  operational_dependencies: []
controls:
  baseline: []
  contextual: []
assurance_recommendation: LIGHT | STANDARD | HIGH_RISK
rationale: []
source_evidence: []
```

Uma matriz versionada combina exposição e impacto com triggers de dados, identidade, integração, reversibilidade e blast radius. `INTERNAL_RESTRICTED` não reduz controles por confiança implícita; somente evidência e contexto podem ajustar bundles.

## Assurance

- `LIGHT`: somente Quick Spec pequena, local, reversível e de baixo risco; lint estrutural substitui Contract Review independente; validação independente permanece.
- `STANDARD`: padrão; Contract Review e validação independentes.
- `HIGH_RISK`: review/validação reforçados, evidência ampliada, stop criteria e checkpoints.

O classificador deve retornar decisão, regras acionadas e evidência. Qualquer finding material ou guarda falha em `LIGHT` produz `STANDARD` antes da execução.

## Dry-run e auto-validação

### Modelo de decisão

O classificador recebe valores normalizados para:

- risco;
- reversibilidade;
- ambiguidade;
- blast radius;
- determinismo;
- idempotência;
- ambiente;
- classe de operação;
- dados/segredos;
- efeito externo;
- autorização e integridade do snapshot.

Saídas: `AUTO_APPLY_ELIGIBLE`, `CHECKPOINT_REQUIRED` ou `BLOCKED`.

### Guardas de autoaplicação

Todas devem ser verdadeiras:

1. autorização vigente cobre a ação;
2. paths/recursos estão contidos;
3. snapshot e hashes conferem;
4. ação é determinística;
5. repetição é inócua ou bloqueada;
6. risco/blast radius são baixos;
7. não há efeito externo, ambiente compartilhado/produção, segredo ou dado sensível;
8. mutação é ausente ou reversível;
9. equivalência do dry-run com o caminho real foi validada;
10. evidência e stop criteria estão completos.

Falha material bloqueia; trigger humano gera checkpoint. O validator não pode converter ausência de autorização em elegibilidade.

## Evidência e manifests

`contracts/schemas/evidence-envelope.schema.yaml` define metadados comuns:

- versão, origem, executor/papel e fase;
- autorização e escopo;
- timestamps e hashes;
- classificação `CONFIRMED_DIRECTLY`, `CONFIRMED_BY_IDENTITY`, `REPORTED`, `INFERRED`, `NOT_EXECUTED`, `BLOCKED`;
- sanitização, resultados, limitações e referências.

`dry-run-manifest.yaml` especializa o envelope com classificação operacional, precondições, efeitos previstos e decisão. `transition-manifest.yaml` especializa com from/to, Skill, guard results, topologia, artefatos e decisão de chaining. Schemas usam composição/referência; não duplicam campos do envelope.

## Chaining e topologia

O transition validator executa em ordem:

```text
autorização explícita
→ artefato finalizado
→ hashes/snapshot compatíveis
→ nenhuma decisão pendente
→ edge na allowlist
→ assurance atendida
→ topologia de sessão correta
→ evidência suficiente
→ nenhum checkpoint pendente
```

Resultado:

- `CHAINED`: inicia a próxima Skill/sessão prevista;
- `CHECKPOINT_REQUIRED`: preserva estado e solicita decisão;
- `BLOCKED`: registra guarda falha e não inicia a fase.

A identidade lógica da sessão deve ser preservada mesmo quando o adapter muda processo físico. Cross-session routing cria contexto mínimo novo e impede reutilização do autor como assurance.

## Políticas canônicas e carregamento progressivo

As políticas são produzidas antes dos classificadores e validators que as consomem. `CapabilitySelectionPolicy.md` expressa somente capacidades mínimas, esforço e fallback; catálogo e nomes concretos de modelos são proibidos no core/políticas e resolvidos exclusivamente em `adapters/<tool>/`. Um contract test injeta nomes concretos fora dos adapters e exige falha, além de verificar que adapters válidos resolvem capacidades sem alterar a semântica do core.

O carregador de contexto opera e registra eventos na ordem `metadados → Skill aplicável → referências necessárias`. A Skill declara referências condicionais, e o carregador resolve apenas as necessárias ao caso corrente. Um teste instrumentado falha diante de inversão da sequência ou carregamento de qualquer referência não solicitada.

## Skills e geração

Uma ferramenta de validação/empacotamento deve:

1. ler as Skills canônicas;
2. validar frontmatter, links e seções essenciais;
3. detectar regras copiadas de políticas/contratos;
4. advertir sobre tamanho > aproximadamente 500 linhas;
5. gerar formatos compatíveis quando necessários;
6. registrar hashes no `framework.lock`;
7. falhar se uma cópia gerada for editada ou divergir.

Não haverá segunda fonte manual equivalente a `SkillsUnified/`.

## Adapters

### ChatGPT

`ProjectInstructions.md` contém missão, precedência, separação de papéis, autoridade, roteamento, economia de resposta, perfis e status. Perfis:

- `DELTA` padrão: mudança, impacto, recomendação, próxima fase e status; ≈300 palavras.
- `DECISION`: decisão, alternativas, impactos e recomendação.
- `HANDOFF`: preâmbulo ≤4 linhas + instrução copiável ≈30 linhas.
- `REVIEW`: decisão, findings, evidência faltante e próxima fase.
- `RESEARCH`: conteúdo mais extenso sem repetição.
- `FULL_ARTIFACT`: somente sob solicitação explícita.

Um validator detecta conteúdo repetido entre seções e metadados duplicados.

### Codex, Claude e Kiro

- Codex: default de engenharia e execução; `AGENTS.md` adapter-specific somente quando necessário.
- Claude: default de assurance, preservando independência.
- Kiro: superfície opcional com agente `Default`; steering/hooks são capacidades do adapter.

Disponibilidade de modelo é runtime; o core expressa capacidade mínima.

## Decision Records

Criar inicialmente:

- `DEC-001-session-topology.md`;
- `DEC-002-autopilot-default.md`;
- `DEC-003-role-mapping.md`;
- `DEC-004-tool-neutral-core.md`.

Cada record contém status, contexto, decisão, alternativas, consequências e referências. A norma executável permanece no core/política correspondente.

## Validators e ferramentas

- `validate-workflow`: schema, estados, reachability, edges e guardas.
- `validate-artifacts`: artefatos, IDs e referências.
- `validate-skills`: formato, links, tamanho e progressive disclosure.
- `detect-duplicate-rules`: similaridade normativa e ownership.
- `validate-adapters`: nomes/capacidades específicos contidos nos adapters.
- `validate-sources`: hashes, gerados e lock.
- `validate-handoff`: perfil, budget flexível e duplicação.
- `validate-application-profile`: enums, matriz, override e rationale.
- `validate-dry-run`: classificação e guardas.
- `validate-transition`: edge, autorização, hash, evidência e sessão.

A implementação usa a toolchain Node.js 24.x/JavaScript ESM/npm definida nesta Spec. O preflight sem Node major 24 ou npm retorna `NEEDS_STATE_VALIDATION`, sem instalação automática; runtime diferente ou dependência material adicional exige decisão e `REQUIRES_REPLANNING` antes da execução.

## Tratamento de erros

- Schema/referência/hash inválido: falha explícita, sem auto-correção material.
- Artefato gerado divergente: falha e instrução para regenerar da fonte.
- Edge desconhecida: bloqueio, não fallback genérico.
- Sessão incompatível: cross-session routing ou bloqueio conforme core.
- Estado parcial: preservar evidência, impedir retry cego e exigir classificação.
- Alias legado: warning com origem/consumidor; em v3.1, falha para novo consumidor.

## Compatibilidade e lifecycle

- **v3.0:** nova estrutura paralela, aliases ativos com warning, `.kiro/` adapter compatibility.
- **v3.1:** referências restantes devem migrar; novos consumidores legados são rejeitados.
- **v3.2:** remoção elegível somente após scan zero de referências/consumidores e validação de adapters.

Instalação global ou migração de projetos é fase operacional separada com inventário, dry-run, backup, rollback e autorização.

## Estratégia de testes

### Unitários/contrato

- schemas positivos e negativos, incluindo override com os sete campos obrigatórios e falhas de autorização/escopo/racional/expiração;
- reachability e transições inválidas;
- capability selection sem catálogo/nome concreto no core e resolução exclusiva nos adapters;
- carregamento instrumentado `metadados → Skill → referências necessárias`, rejeitando referências não solicitadas;
- matriz 4×4 de exposição/impacto;
- assurance LIGHT/STANDARD/HIGH_RISK;
- classificador de dry-run e guardas fail-closed;
- transition validator e topologia;
- geração de Skills e lock;
- adapters versus core.

### Cenários/Evals

- demanda ambígua não implementada;
- pequena mudança elegível para LIGHT e Quick Spec;
- finding material escala LIGHT;
- produção/high risk preserva checkpoint;
- modelo preferido indisponível não bloqueia quando capacidade equivalente existe;
- primeira garantia é independente; follow-up retoma sessão original;
- chaining autorizado reduz handoff;
- chaining tenta ampliar autorização e bloqueia;
- perfis ChatGPT respeitam economia e não repetem;
- Kiro sempre usa Default;
- aliases seguem lifecycle e não removem consumidor ativo.

### Evidência

Relatórios de schema/testes, matriz de rastreabilidade, comparação v2.4→v3.0, scan de duplicação/tool coupling, hashes do lock e manifests sanitizados.

## Rollout e rollback

### Rollout técnico

1. Fazer preflight de Node.js major 24/npm e construir core/máquina de estados na estrutura paralela.
2. Criar contratos, schemas e validadores estruturais básicos.
3. Estabelecer políticas como fontes canônicas únicas antes dos classificadores consumidores.
4. Implementar perfil técnico e assurance sobre essas políticas.
5. Implementar dry-run fail-closed.
6. Implementar chaining e topologia de sessões.
7. Migrar Skills uma a uma com equivalência e carregamento progressivo.
8. Implementar adapters, aliases e resolução concreta de modelos.
9. Criar Decision Records e compatibilidade versionada.
10. Executar evals, matriz de equivalência e empacotamento local sem instalar.
11. Somente em entrega operacional posterior, migrar instalação/projetos.

### Rollback

Durante construção paralela, rollback é descartar somente o delta v3 não publicado, preservando fontes. Após futura instalação, rollback deve restaurar versão/manifesto anterior e compatibilidade do projeto; não pode depender apenas de Git.

## Observabilidade

Validators devem emitir saída estruturada com regra, objeto, severidade, evidência e ação. Manifests registram transições e dry-runs. Não registrar prompts integrais, segredos ou conteúdo de projeto desnecessário.

## Checkpoints

- Mudança material de decisão arquitetural: replanejamento.
- Runtime diferente de Node.js 24.x ou dependência material adicional: replanejamento antes da execução; ausência de Node major 24/npm no host é `NEEDS_STATE_VALIDATION`, sem auto-instalação.
- Escrita global, migração de projeto, remoção de alias, publicação ou remoto: checkpoint e autorização próprios.
- Resultado divergente da matriz de equivalência: interromper execução.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Perda semântica ao reduzir documentos | Matriz v2.4→v3.0, Contract Review e cenários de equivalência. |
| Segunda fonte normativa gerada | Hash/lock e falha em edição manual. |
| Chaining com autoridade excessiva | Allowlist, autorização explícita e guards fail-closed. |
| Perfil subdimensionado | Matriz objetiva + triggers contextuais + assurance review. |
| Adapter alterar core | Testes de contrato e scan de tool coupling. |
| Compatibilidade infinita | Lifecycle versionado e bloqueio de novos consumidores em v3.1. |

## Alternativas rejeitadas

- Manter documentos monolíticos: perpetua repetição e custo de contexto.
- Tornar Kiro parte do core: reduz portabilidade.
- Um manifesto único para dry-run/transição: mistura responsabilidades distintas.
- Confiar apenas em prompts: não fornece enforcement determinístico.
- Remover aliases na v3.0: quebra consumidores antes da migração.
- Eliminar validação independente em LIGHT: reduz garantia além do aprovado.

## Rastreabilidade de design

| Grupo de requisitos | Seções de design |
|---|---|
| REQ-001–006 | Core e máquina de estados |
| REQ-007–014 | Boundaries; Políticas canônicas e carregamento progressivo; Skills e geração; validators |
| REQ-015–018 | Raiz de projeto; compatibilidade e lifecycle |
| REQ-019–030 | Perfil técnico; Assurance |
| REQ-031–036 | Dry-run e auto-validação |
| REQ-037–043 | Evidência; Chaining e topologia |
| REQ-044–048 | Adapters |
| REQ-049–054 | Decision Records; validators; rollout/rollback |

## Pendências

Nenhuma decisão material aberta. A implementação local usa `/home/villas/Projects/AgenticDevOps/framework/` com Node.js 24.x, JavaScript ESM e npm conforme a toolchain aprovada. Ausência de Node major 24/npm no preflight produz `NEEDS_STATE_VALIDATION`; runtime diferente, dependência material adicional ou destino diferente exige `REQUIRES_REPLANNING`.