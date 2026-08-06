# Discovery — Framework v3.0

## Identificação

- **Status:** APPROVED_FOR_SPEC
- **Fase:** low-level discovery
- **Projeto:** AgenticDevOps
- **Slug:** framework-v3
- **Tipo:** evolução arquitetural transversal do framework
- **Linha de sessão:** engenharia e autoria
- **Estratégia de sessão:** retomar sessão autora
- **Sessão/papel:** `engineering-author/framework-v3`
- **Executor resolvido:** Kiro
- **Superfície / host:** IDE / Linux
- **Família / modelo resolvidos:** Codex / GPT-5.6 Sol
- **Agente/Workflow Kiro:** Default
- **Modo:** Autopilot
- **Git / branch / HEAD / base:** não consultados; Git foi explicitamente proibido nesta rodada
- **Última atualização:** 2026-07-28

## Fontes

- Fonte principal atual: `/home/villas/Projects/AgenticDevOps/Kiro_v2_4_source/`
- Referência histórica: `/home/villas/Projects/AgenticDevOps/Kiro_v2_3_source/`
- Base de análise v3.0: `/home/villas/Projects/AgenticDevOps/Analise_Workflow_v3.0.md`
- Instruções locais: `/home/villas/Projects/AgenticDevOps/AGENTS.md`

As fontes foram somente consultadas. Não foram copiadas, movidas ou modificadas.

## Instrução de origem

Definir a evolução estrutural da v2.4 para a v3.0, preservando o comportamento consolidado e sem implementar a migração nesta rodada. A arquitetura deve ser independente de ferramenta, ter fonte canônica única por Skill, aplicar segurança proporcional, formalizar dry-runs auto-validados e permitir encadeamento seguro de fases já autorizadas.

## Objetivo confirmado

A v3.0 deve:

1. preservar o fluxo entre consultoria, engenharia, garantia do contrato, garantia da entrega e closeout;
2. separar semântica do workflow de ferramentas, modelos e superfícies;
3. manter uma única fonte canônica em `skills/<slug>/SKILL.md`;
4. eliminar repetição manual de Skills, templates e metadados operacionais;
5. classificar segurança de modo proporcional ao estado real da aplicação;
6. automatizar dry-runs seguros e determinísticos sem transformar automação em autorização;
7. encadear Skills já autorizadas sem ampliar escopo e sem violar a topologia de sessões;
8. provar por testes que os handoffs diminuem sem perda de segurança, independência ou controle humano.

## Escopo

Inclui a direção arquitetural futura para core, políticas, contratos, schemas, templates, Skills, adaptadores, validadores, evidência, testes e migração de compatibilidade.

## Fora do escopo

- Implementar a v3.0 nesta rodada.
- Alterar as árvores v2.3 ou v2.4.
- Alterar ou mover `Analise_Workflow_v3.0.md`.
- Alterar instalação global, Git, remoto, CI/CD, release ou deploy.
- Fixar runtime, package manager ou comandos ainda não confirmados.

## Estado atual da aplicação

### Inventário v2.4 — CONFIRMED_DIRECTLY

- `Controls/` expõe `workflow-core.md` e `DiscoveryRouter.md`.
- `Contracts/` contém oito contratos.
- `Skills/` contém dez Skills canônicas, cada uma em `<slug>/SKILL.md`.
- `SkillsUnified/` contém dez cópias alternativas correspondentes às Skills canônicas.
- Formatos de artefatos e evidências estão embutidos em contratos e Skills.
- Não foram localizados, nas buscas direcionadas, schemas, templates externos, adapters, validators, scripts, `workflow.yaml`, manifestos estruturados ou arquivos YAML da futura v3.0.
- O fluxo preserva gate de alinhamento após discovery técnico, continuidade da autoria, primeira revisão e primeira validação independentes e autorizações explícitas.
- Autopilot é o padrão; Supervised é reservado a intervenção humana pendente.

### Inventário v2.3 — CONFIRMED_DIRECTLY

- Possui estrutura equivalente de oito contratos, dez Skills e dez cópias em `SkillsUnified/`.
- Expõe também `Controls/AGENTS.md` e `Controls/ProjectInstructions.md`.
- Usa vocabulário mais acoplado a Kiro, seleção de modelo e modos operacionais específicos.
- Serve somente como referência histórica; não possui autoridade equivalente à v2.4.

### Estado do workspace — CONFIRMED_DIRECTLY

- O bootstrap autorizado criou `AGENTS.md` e `.kiro/specs/`.
- `.kiro/specs/` estava vazio imediatamente antes deste artefato.
- Este arquivo é a única escrita autorizada nesta fase.

## Problema real

O comportamento do workflow está consolidado, mas sua representação distribui a mesma responsabilidade por vários documentos. Core, router, contratos e Skills repetem regras de modelo, sessão, modo, Git, segurança e formatos de artefato. As cópias em `SkillsUnified/` criam uma segunda superfície manual suscetível a drift. Faltam contratos estruturados para validar máquina de estados, perfis de segurança, dry-runs e transições encadeadas.

## Premissas confirmadas

- **CONFIRMED_DIRECTLY:** v2.4 é a base funcional mais atual disponível no workspace.
- **CONFIRMED_DIRECTLY:** o fluxo comportamental já separa autoria e garantia adequadamente.
- **CONFIRMED_DIRECTLY:** há duplicação física das dez Skills em `SkillsUnified/`.
- **CONFIRMED_DIRECTLY:** segurança e alto risco já contemplam baseline, dry-run, idempotência, rollback e checkpoints, mas sem classificação estruturada única de aplicação/dry-run.
- **DECIDED_BY_USER:** ChatGPT é preferência para `CONSULTING`, Codex para `ENGINEERING`, Claude para assurance e Kiro é superfície opcional sempre com agente `Default`.
- **DECIDED_BY_USER:** fases pertencem às Skills do framework, não aos workflows nativos do Kiro.
- **DECIDED_BY_USER:** a fonte canônica de cada Skill será `skills/<slug>/SKILL.md`; cópias alternativas serão geradas.
- **DECIDED_BY_USER:** `STANDARD` será o perfil de assurance padrão.

## Premissas refutadas

- Uma aplicação interna ou isolada não precisa herdar automaticamente controles de aplicação pública ou produção crítica.
- Classificar uma aplicação como interna não elimina controles baseline realmente aplicáveis.
- Autopilot não representa autorização adicional.
- Um modelo recomendado indisponível não deve bloquear a fase quando capacidade e governança continuarem satisfeitas.
- Encadear fases não equivale a autorizar a próxima fase nem permite reutilizar autoria como assurance independente.

## Arquitetura v3.0 recomendada

```text
core/
  workflow-core.md
  workflow.yaml
  WorkflowRouter.md
  roles.yaml
  statuses.yaml
policies/
  context.md
  environment.md
  git.md
  security.md
  high-risk.md
  capability.md
contracts/
  artifact-contract.md
  evidence-contract.md
  schemas/
  templates/
skills/<slug>/
  SKILL.md
  references/
  scripts/
  assets/
adapters/
  chatgpt/
  codex/
  claude/
  kiro/
tests/
  workflow/
  policies/
  contracts/
  skills/
  scenarios/
framework.lock
```

### Core tool-neutral

`workflow.yaml` deve representar fases, papéis, estados, artefatos exigidos, transições, guardas, requisitos de independência, checkpoints e condições de chaining. `roles.yaml` define papéis abstratos:

- `CONSULTING`: high-level discovery, alinhamento, decisão e roteamento.
- `ENGINEERING`: low-level discovery, Spec, execução, correção e closeout.
- `CONTRACT_ASSURANCE`: Contract Review.
- `DELIVERY_ASSURANCE`: validação e revalidação.

As preferências ChatGPT, Codex, Claude e Kiro pertencem aos adapters. Adapters não podem alterar a semântica do core. O adapter Kiro usa sempre `Default`.

`WorkflowRouter.md` substitui `DiscoveryRouter.md`. Um alias gerado e temporário deve preservar compatibilidade até que todas as referências tenham sido migradas e validadas.

### Progressive disclosure e fonte única

- `SKILL.md` mantém uso, entradas, procedimento, limites, saídas, stop conditions e transições.
- Formatos compartilhados ficam em `contracts/templates/`.
- Estruturas validáveis ficam em `contracts/schemas/`.
- Política transversal fica em `policies/`.
- Comandos e capacidades específicas ficam em adapters ou scripts.
- Exemplos extensos ficam em `references/` ou `assets/`.
- Cópias compatíveis de Skills devem ser geradas e comparadas com a fonte canônica; edição manual da cópia deve falhar na validação.
- `ProjectInstructions.md`, se mantido, carrega apenas delta local e nunca reproduz core, políticas, contratos, Skills ou templates.

### Adapter ChatGPT e economia de resposta

O adapter ChatGPT deve oferecer os perfis `DELTA`, `DECISION`, `HANDOFF`, `REVIEW`, `RESEARCH` e `FULL_ARTIFACT`. `DELTA` é o padrão. Budgets são defaults flexíveis, não limites cegos:

- `DELTA`: aproximadamente 300 palavras;
- `HANDOFF`: preâmbulo de até quatro linhas e instrução de até aproximadamente 30 linhas;
- `REVIEW`: somente decisão, findings, evidência faltante e próxima fase.

A mesma informação não pode ser duplicada entre preâmbulo, análise, conclusão e handoff. `FULL_ARTIFACT` exige solicitação explícita; `RESEARCH` pode ser extenso, mas não repetitivo.

### Decision Records

Decisões arquiteturais permanentes devem ser versionadas em Decision Records concisos. O conjunto inicial cobre topologia de sessões, Autopilot como padrão, papéis abstratos/mapeamento de adapters e core tool-neutral. Cada record registra contexto, decisão, alternativas, consequências, status e relação com schemas/políticas, sem duplicar o conteúdo normativo.

## Segurança proporcional

A v3.0 deve separar três dimensões independentes:

1. **Perfil técnico da aplicação:** salvaguardas técnicas derivadas de exposição, ambiente, identidade, dados, integrações, criticidade, reversibilidade e blast radius.
2. **Assurance do workflow:** `LIGHT`, `STANDARD` ou `HIGH_RISK`; define rigor de planejamento, review, validação, evidência e checkpoints. `STANDARD` é o padrão. `LIGHT` é permitido somente para Quick Spec pequena, local, reversível e de baixo risco; substitui Contract Review independente por lint estrutural automatizado, mas preserva validação independente. Finding material ou falha de guarda eleva automaticamente `LIGHT` para `STANDARD`. `HIGH_RISK` exige review, validação, evidência e checkpoints reforçados.
3. **Risco operacional da ação:** avalia a operação concreta e ativa `HighRiskOverlay` quando necessário.

O baseline sempre aplicável inclui validação em fronteiras reais, menor privilégio, proteção de segredos, defaults e erros seguros, revisão de dados/dependências/logs, revisão de diff/escopo e testes negativos quando houver entrada, permissão, integração ou falha relevante.

Controles reforçados são ativados por contexto. Uma aplicação local e isolada não recebe automaticamente controles de rede pública, mas continua sujeita aos controles baseline que de fato se aplicam. Contract Review e validação devem identificar tanto controles insuficientes quanto controles excessivos sem benefício material.

**Decisão confirmada:** o schema do perfil técnico é `contracts/schemas/application-profile.schema.yaml`. A instância canônica do projeto é `.agentic/application-profile.yaml`; `.agentic/specs/<slug>/application-profile.override.yaml` é permitido somente para exceção material, explícita e rastreável da entrega. `.agentic/` é a raiz futura tool-neutral, enquanto `.kiro/` permanece como compatibilidade temporária do adapter Kiro durante a migração.

O perfil usa duas dimensões independentes:

- **Exposição:** `LOCAL_ISOLATED`, `INTERNAL_RESTRICTED`, `EXTERNAL_RESTRICTED` ou `PUBLIC`.
- **Impacto:** `LOW`, `MODERATE`, `HIGH` ou `CRITICAL`.

Exposição e impacto são combinados por regras objetivas no schema e nas políticas. Rede interna nunca implica confiança por si só nem reduz controles sem evidência explícita.

## Dry-runs auto-validados

Cada dry-run deve produzir um manifesto estruturado contendo:

- operação, recurso, ambiente, paths e limites;
- autorização de origem, escopo e hashes dos artefatos;
- risco, reversibilidade, ambiguidade e blast radius;
- mutação prevista, determinismo, idempotência e equivalência com o caminho real;
- snapshot de pré-condições e hashes;
- efeitos estimados, volume, custo, tempo, rollback e critérios de interrupção;
- verificações executadas, evidências e decisão.

### Classificação objetiva

| Decisão | Critérios |
|---|---|
| `AUTO_APPLY_ELIGIBLE` | Ação read-only ou local de escopo fixo; determinística; idempotente quando repetível; sem efeito externo, segredo ou dado sensível; sem ambiente compartilhado/produção; reversível ou sem mutação; baixo risco e blast radius; nenhuma ambiguidade; autorização, paths, hashes, pré-condições, equivalência e evidência válidos. |
| `CHECKPOINT_REQUIRED` | Escrita externa/remota; ambiente compartilhado/produção; dados, schema, permissão, segurança ou infraestrutura; baixa reversibilidade; blast radius alto/crítico; ambiguidade; equivalência incompleta; decisão material; ou checkpoint exigido pelo contrato. |
| `BLOCKED` | Autorização ausente; escopo/snapshot divergente; condição insegura; efeito parcial desconhecido; rollback/observabilidade obrigatórios ausentes; validação falha; ou evidência insuficiente. |

A auto-validação deve verificar schema, autorização, hashes, paths, precondições, equivalência e evidências de forma determinística. Ela não concede autorização. Somente dry-runs classificados como `AUTO_APPLY_ELIGIBLE` podem ser aplicados automaticamente.

### Checkpoint humano obrigatório

É obrigatório quando ocorrer qualquer um destes fatos:

- nova decisão de comportamento, escopo, arquitetura, dados, segurança, integração ou risco;
- escrita remota ou efeito externo material;
- ambiente compartilhado, produção ou recurso protegido;
- mudança destrutiva, pouco reversível ou com alto blast radius;
- segredo, dado sensível, permissão, schema, infraestrutura, release, deploy ou migração;
- ambiguidade, estado não atribuível, efeito parcial ou divergência entre dry-run e operação;
- autorização nova/ampliada ou ação não coberta pelo lote atual;
- validação, evidência, rollback ou observabilidade insuficientes;
- requisito explícito do contrato ou do usuário.

## Encadeamento direto entre Skills

O encadeamento reduz handoffs apenas quando a próxima fase já estiver autorizada e todas as guardas passarem. Cada transição deve registrar:

- `from_phase`, `to_phase` e Skill/versionamento;
- referência inequívoca da autorização;
- hashes de escopo, artefatos e snapshot;
- linha de sessão, sessão de origem, sessão de destino e requisito de independência;
- resultados das guardas e decisão `CHAINED`, `CHECKPOINT_REQUIRED` ou `BLOCKED`;
- evidências, ações realizadas e ações não executadas.

Guardas obrigatórias:

1. autorização explícita da próxima fase;
2. escopo e estado compatíveis com a autorização;
3. nenhuma mudança material ou novo efeito operacional;
4. artefato de origem finalizado e evidência suficiente;
5. topologia de sessão correta;
6. nenhum checkpoint humano pendente.

A primeira revisão e a primeira validação continuam em sessões independentes e usam cross-session routing obrigatório. Um chain pode iniciar a sessão independente correta, mas não reutilizar a sessão autora/executora como garantia. Rework volta ao autor; follow-up ao reviewer original; correção ao executor; revalidação ao validator original.

### Allowlist inicial de chaining

- `workflow-bootstrap → low-level-discovery`;
- `low-level-discovery → quick-spec | spec | bug-fix`;
- `quick-spec | spec | bug-fix → contract-review`;
- `contract-review APPROVED → execute-contract`;
- `contract-review REWORK → sessão autora`;
- `execute-contract → validate-delivery`;
- `validate-delivery FINDINGS → correct-from-validation`;
- `correct-from-validation → revalidação`;
- passos internos de lote explicitamente autorizado de `delivery-closeout`.

Toda edge exige autorização explícita, artefato de origem finalizado, hashes compatíveis, ausência de decisão pendente e topologia correta. A allowlist habilita roteamento; não concede autorização.

Encadeamento é proibido para presumir autorização, ampliar paths, escopo, permissões, risco aceito, lote Git ou operação remota. Ele para diante de decisão do usuário, finding material, evidência ausente, guarda falha ou estado não atribuível.

## Evidência estruturada

A decisão confirmada mantém dois manifestos:

- `dry-run-manifest.yaml`: classificação, auto-validação, snapshot, efeito previsto e decisão operacional.
- `transition-manifest.yaml`: autorização, hashes, guardas, topologia de sessão, Skill chamada e resultado da transição.

Ambos reutilizam `contracts/schemas/evidence-envelope.schema.yaml` para identidade, origem, classificação da evidência, timestamps, hashes, sanitização e resultado. Devem ser versionados, validáveis por máquina e referenciados pela evidência humana da rodada. O manifesto registra fato; não substitui `EXECUTION.md`, `VALIDATION.md` ou checkpoint exigido.

## Estratégia futura de validação

Validadores recomendados:

- `validate-workflow`: estados, fases, transições e guardas.
- `validate-artifacts`: schemas, templates e rastreabilidade.
- `validate-skills`: estrutura e progressive disclosure.
- `detect-duplicate-rules`: responsabilidade duplicada e drift.
- `validate-sources`: fonte canônica, cópias geradas e lock.
- `validate-adapters`: adapters não alteram o core.
- `validate-application-profile`: classificação e bundles proporcionais.
- `validate-dry-run`: elegibilidade, checkpoint e bloqueio.
- `validate-transition`: autorização, hashes, guards e sessão.

### Cenários de teste obrigatórios

1. Aplicação local isolada recebe baseline sem controles públicos irrelevantes.
2. Aplicação interna mantém autorização, segredo, input e backup aplicáveis.
3. Aplicação `EXTERNAL_RESTRICTED` recebe controles reforçados.
4. Aplicação pública ativa proteção e assurance proporcionais.
5. Aplicação crítica ativa `HIGH_RISK`, checkpoints e overlay.
6. Dry-run local, determinístico e reversível é auto-validado e aplicado sem handoff redundante.
7. Dry-run com hash/path divergente é bloqueado.
8. Escrita remota, produção ou baixa reversibilidade exige checkpoint.
9. Chain pré-autorizado na mesma linha reduz uma ida e volta e preserva evidências.
10. Chain para Contract Review/validação inicia sessão independente.
11. Follow-up e revalidação retomam as sessões originais.
12. Chain tenta ampliar arquivo, escopo ou autorização e é bloqueado.
13. Mudança material durante chain retorna à fase correta.
14. Comparação com v2.4 mede número de checkpoints/handoffs e demonstra redução apenas onde não havia decisão humana material.
15. Falha parcial ou estado incerto interrompe autoaplicação e preserva evidência.

Métricas mínimas: quantidade de handoffs, checkpoints obrigatórios preservados, autorizações adicionais indevidamente inferidas (meta zero), violações de topologia (meta zero), transições sem evidência (meta zero) e falsos `AUTO_APPLY_ELIGIBLE` (meta zero no conjunto de cenários críticos).

## Compatibilidade e migração recomendada

1. Congelar v2.4 como baseline de comparação.
2. Construir v3.0 em árvore paralela.
3. Extrair core declarativo e schemas sem mudar comportamento.
4. Migrar políticas e templates compartilhados.
5. Reduzir Skills à fonte canônica e gerar cópias compatíveis.
6. Introduzir adapters e validadores.
7. Manter em v3.0 o alias `DiscoveryRouter.md` → `WorkflowRouter.md` com warning.
8. Tornar obrigatória em v3.1 a migração de referências legadas restantes.
9. Tornar o alias elegível para remoção em v3.2 somente quando nenhuma referência ou consumidor legado existir.
10. Executar testes de equivalência, segurança, dry-run e chaining.
11. Publicar `framework.lock` com versões/hashes das fontes geradas.

## Segurança e risco

- **Ativos:** integridade das regras, artefatos, autorizações, topologia de sessões, evidências e histórico.
- **Fronteiras:** usuário, agentes/modelos, adapters, ferramentas, conteúdo recuperado, shell, Git e serviços remotos.
- **Riscos principais:** drift entre fontes; adapter alterar semântica; auto-validação conceder autorização; chain violar independência; perfil subestimar exposição; controles excessivos criarem custo sem benefício; migração quebrar referências.
- **Mitigações propostas:** fonte única, schemas versionados, hashes/lock, guardas fail-closed, testes negativos, adapters limitados, compatibilidade temporária e Contract Review independente.
- **Blast radius da futura implementação:** alto, pois o framework afeta todas as fases e projetos preparados. A implementação deverá aplicar `HighRiskOverlay` proporcionalmente à atualização global, mas esta fase é somente discovery local.

## Evidências consultadas

- **CONFIRMED_DIRECTLY:** arquivos de core, router, contratos e Skills v2.4 listados na seção Fontes.
- **CONFIRMED_DIRECTLY:** controles históricos e Skills v2.3 usados somente para comparação.
- **CONFIRMED_DIRECTLY:** análise v3.0 no caminho original.
- **CONFIRMED_DIRECTLY:** inventário estrutural que identificou as duplicatas e a ausência dos componentes estruturados propostos.
- **REPORTED_AND_PREVIOUSLY_VERIFIED:** integridade do framework global e resultado do bootstrap local.
- **NOT_EXECUTED:** testes, builds, runtime, Git e operações remotas; não eram necessários ou eram proibidos para este discovery documental.

## Hipóteses e confiança

- **Alta:** core declarativo, schemas e fonte única reduzirão drift e permitirão validação automática.
- **Alta:** guardas estruturadas podem reduzir handoffs sem reduzir segurança quando a próxima fase já estiver autorizada.
- **Média:** as regras objetivas de combinação entre exposição e impacto cobrem todos os projetos; sua calibragem precisa ser confrontada nos testes de cenário.
- **Alta:** os dois manifestos separados reduzem acoplamento entre decisão operacional e transição de fase, compartilhando o mesmo evidence envelope.

## Trade-offs

- Mais schemas e validadores aumentam custo inicial, mas reduzem ambiguidade e drift.
- Separar perfil de aplicação, assurance e risco operacional evita inflação defensiva, porém exige regras claras de composição.
- Chaining melhora fluidez, mas somente com guards fail-closed; permissividade reduziria controle.
- Compatibilidade gerada facilita migração, mas cria dívida temporária limitada pelo lifecycle v3.0/v3.1/v3.2 e pelo bloqueio de remoção enquanto houver consumidor legado.
- Preferências de modelo aumentam qualidade quando disponíveis, mas não devem virar dependência rígida.

## Decisões confirmadas no alinhamento

1. `contracts/schemas/application-profile.schema.yaml` é o schema; `.agentic/application-profile.yaml` é a instância canônica do projeto; override por entrega existe apenas para exceção material.
2. Exposição e impacto usam enums independentes e combinação objetiva, sem confiança implícita em rede interna.
3. `LIGHT` restringe-se a Quick Spec pequena/local/reversível/de baixo risco, usa lint estrutural e preserva validação independente; falha material eleva para `STANDARD`.
4. `dry-run-manifest.yaml` e `transition-manifest.yaml` permanecem separados e reutilizam o evidence envelope.
5. A allowlist inicial de chaining é a registrada neste discovery, sempre condicionada às guardas obrigatórias e ao cross-session routing de assurance.
6. Aliases seguem lifecycle v3.0/v3.1/v3.2 e não podem ser removidos enquanto houver referência ou consumidor legado.

Não há decisão material pendente para iniciar a Spec. Descoberta futura que altere essas decisões exige retorno ao alinhamento.

## Tipo de Spec recomendado

**Spec completa.** A mudança é transversal, afeta governança, segurança, contratos, automação, compatibilidade e múltiplas superfícies. Quick Spec e Bug Fix são inadequados.

## Critérios iniciais de aceite

- Core não contém dependência obrigatória de fornecedor ou superfície.
- Toda fase e transição está representada e validada.
- Cada Skill possui uma única fonte manual canônica.
- Cópias geradas falham diante de drift.
- Segurança é proporcional e testada nos cinco cenários de aplicação.
- Dry-run só autoaplica quando todas as guardas objetivas passarem.
- Checkpoints materiais continuam obrigatórios.
- Chaining nunca cria autorização nem viola topologia de sessões.
- Evidência estruturada vincula autorização, estado, hashes, guards e resultado.
- Testes comparativos demonstram redução de handoffs sem autorização inferida, bypass de checkpoint ou perda de independência.
- Migração preserva comportamento v2.4 e referências durante a janela de compatibilidade.

## Prontidão

O discovery possui inventário, direção técnica, riscos, trade-offs, critérios iniciais e todas as decisões materiais confirmadas. Está `APPROVED_FOR_SPEC` e autoriza o encadeamento para a Skill `spec` dentro do lote atual, sujeito à auto-validação das guardas.

## Seleção recomendada para a próxima fase

A finalização foi autorizada e todas as decisões pendentes foram resolvidas. Após auto-validação das guardas, encadear nesta sessão `engineering-author/framework-v3` para a Skill `spec`, modo `AUTHOR`, estratégia `Requirements-First`.

- **Executor preferencial:** Kiro com preferência de engenharia Codex
- **Superfície:** IDE
- **Família / modelo:** Codex / modelo disponível com capacidade para arquitetura transversal; recomendação não bloqueante
- **Esforço:** High
- **Agente/Workflow Kiro:** Default
- **Modo:** Autopilot, salvo decisão humana pendente
- **Estratégia de sessão:** retomar sessão autora
- **Fallback:** modelo de capacidade equivalente aprovado; sem downgrade silencioso se o risco aumentar

A primeira Contract Review posterior deverá abrir sessão independente de `CONTRACT_ASSURANCE`, com preferência Claude.
