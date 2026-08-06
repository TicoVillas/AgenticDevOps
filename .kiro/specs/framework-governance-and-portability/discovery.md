# Low-Level Discovery — Framework Governance and Portability

## Identificação e lineage

- **Projeto:** `/home/villas/Projects/AgenticDevOps`
- **Fonte canônica:** `/home/villas/Projects/AgenticDevOps/framework`
- **Slug:** `framework-governance-and-portability`
- **Linha:** `engineering-author/framework-governance-and-portability`
- **Fase:** `low-level-discovery`
- **Rodada de origem:** `round-01`
- **Finalização de alinhamento:** `low-level-discovery/alignment-finalization/round-02`
- **Papel:** `ENGINEERING`
- **Overlay:** `HighRiskOverlay`, proporcional a exclusões futuras, Git, distribuição e supply chain
- **Caminho canônico deste artefato:** `.kiro/specs/framework-governance-and-portability/discovery.md`
- **Escrita desta rodada:** somente este artefato

## Seleção efetiva registrada antes do preflight

```yaml
selection_guidance:
  recommended:
    family: Codex
    model: GPT-5.6 Sol
    effort: MEDIUM
    agent_workflow: Kiro Default
    mode: AUTOPILOT
    rationale: Finalização de alinhamento documental com delta delimitado e sem implementação.
  fallback_guidance:
    family: Codex
    model: GPT-5.6 Terra
    effort: HIGH
    condition: Alternativa sugerida e não bloqueante.
effective_selection:
  family: Codex
  model: GPT-5.6 Sol
  effort: MEDIUM
  agent_workflow: Kiro Default
  mode: AUTOPILOT
  suggested_alternative_used: false
comparison_result: MATCH
```

O registro acima foi realizado antes do preflight. A seleção efetiva é uma decisão do usuário no Kiro e não foi reavaliada, substituída ou condicionada pelo executor.

## Escopo e limites da descoberta

Esta descoberta confronta os objetivos alinhados com o estado real de `framework/**`, única autoridade canônica da v3.0. As árvores `Kiro_v2_3_source/**`, `Kiro_v2_4_source/**`, os generated Skills e o runtime global foram tratados somente como histórico, derivados ou estado observado, nunca como autoridade sobre o framework.

A rodada não autoriza nem executa:

- implementação de schemas, adapters, validators ou Skills;
- criação de installers ou pipeline;
- archive, movimentação, reorganização ou exclusão;
- inicialização ou alteração de Git;
- criação de repositório GitHub, push, tag ou release;
- instalação, atualização, rollback ou desinstalação global;
- `PROJECT_UPDATE` real;
- fresh-install validation;
- encadeamento para `spec`.

## Resumo executivo

O framework já possui fundamentos sólidos de governança tool-neutral, adapters concretos, distribuição determinística por manifest e hashes, snapshot/planner fail-closed, backup, journal, receipt, reconciliação e rollback sintéticos. Entretanto, ainda não possui contrato implementado por rodada para recomendação e registro efetivo de modelo, installers executáveis, operação de uninstall, lifecycle dedicado a `PROJECT_UPDATE`, repositório Git canônico ou pipeline de release privada.

A abordagem fechada é:

1. manter core, políticas universais e Skills provider-neutral;
2. registrar recomendação e seleção efetiva sem transformar recomendação em gate;
3. manter nomes concretos somente em adapters e handoffs;
4. promover o conteúdo atual de `framework/` para a raiz do repositório privado canônico `TicoVillas/AgenticDevOps`;
5. manter `AGENTS.md`, `.agentic/**` e `.kiro/specs/**` sob governança do repositório, mas fora de packages e assets de runtime;
6. planejar a primeira versão como `3.1.0`;
7. distribuir por releases com tags SemVer exatas, imutabilidade e assets vinculados por hashes assinados;
8. instalar a partir de staging efêmero, sem clone permanente, priorizando GitHub CLI autenticado;
9. separar lifecycle global, `PROJECT_UPDATE`, Git, publicação, archive, limpeza e fresh install em operações autorizadas independentemente;
10. manter a limpeza local como último milestone, somente após archive restaurável, release verificável, fresh install Linux comprovado e preservação integral do workspace anterior.

## Decisões fechadas na alignment-finalization round-02

As decisões desta seção estão fechadas e não retornam como perguntas de arquitetura. Somente indisponibilidade técnica, validação em host e suporte efetivo do plano GitHub permanecem gates objetivos.

| Tema | Decisão fechada |
|---|---|
| Repositório canônico | Repositório privado `TicoVillas/AgenticDevOps` |
| Layout | O conteúdo atual de `framework/` será promovido para a raiz |
| Governança | `AGENTS.md`, `.agentic/**` e `.kiro/specs/**` pertencem ao repositório e são excluídos de packages/assets de runtime |
| Primeira versão | `3.1.0` |
| Tags/releases | Tags SemVer exatas e release imutável são obrigatórias; sem suporte nativo, publicação bloqueada até controle compensatório aprovado |
| Attestations | Artifact attestations privadas são opcionais e não bloqueantes para `3.1.0` |
| Assinatura | Release manifest e checksums assinados com Ed25519; chave privada protegida e externa; chave pública versionada; rotação/revogação detalhadas na futura Spec |
| Download | GitHub CLI autenticado; alternativas: API GitHub com fine-grained token read-only ou bundle offline verificado |
| Histórico | Repositório privado `TicoVillas/AgenticDevOps-History`, retenção indefinida |
| Preservação v2.3 | Git bundle completo/verificável, snapshot compactado e manifest de proveniência com hashes por arquivo |
| TGZ atual | Evidência histórica não confiável; nunca release candidate; release reconstruída em ambiente limpo |
| Primeiro alvo | Linux x86-64, Bash 5+, Node.js 24 e npm compatível com o lock validado |
| Windows projetado | Windows 11 e PowerShell 7.4+; suporte não validado até execução em host real |
| `PROJECT_UPDATE` | Propõe mudanças por padrão; checkpoint explícito antes de aplicar; nunca altera silenciosamente `application-profile.yaml` |
| Uninstall | Restaura estado anterior somente nos paths gerenciados; preserva conteúdo não gerenciado ou modificado pelo usuário |
| Licenciamento | Política privada de uso interno, todos os direitos reservados, substituindo `UNLICENSED` |
| Limpeza | Último milestone e condicionada aos quatro gates objetivos definidos acima |

### Retenção operacional fechada

- receipts, journals e tombstones: retenção indefinida;
- backup original da primeira instalação: preservado enquanto o framework estiver instalado;
- backups de update: três versões bem-sucedidas e, cumulativamente, no mínimo 90 dias;
- após uninstall: tombstone por tempo indefinido e backups por 30 dias, salvo retenção manual;
- backup associado a operação `UNKNOWN`, `PARTIAL` ou não reconciliada nunca é removido.

## Preflight read-only

### Host e runtime

| Item | Estado confirmado |
|---|---|
| Sistema | Ubuntu 26.04 LTS, Linux 7.0, x86-64 |
| Shell | Bash 5.3.9 |
| Node.js | `v24.18.0` |
| npm | `11.16.0` |
| Git | `2.53.0` |
| GitHub CLI | `2.46.0` |
| PowerShell | indisponível |
| Filesystem | Btrfs, montado `rw` |
| Usuário | `villas`, UID/GID 1000 |
| Raiz, `framework/` e `.kiro/` | `775`, `villas:villas` |

A conta possui permissão efetiva de escrita, mas a autorização desta rodada permanece restrita ao caminho canônico do discovery.

### Git, symlinks e writers

- A raiz do projeto não é repositório Git.
- `framework/` não é repositório Git.
- `Kiro_v2_3_source/` é o único repositório Git aninhado conhecido, em detached HEAD e com status limpo no preflight original.
- `Kiro_v2_4_source/` não é repositório Git.
- Os caminhos de primeiro nível observados não são symlinks.
- Nenhum descritor de arquivo aberto para escrita dentro do projeto foi observado no preflight original.
- Kiro, shell e Nautilus possuíam o diretório como `cwd`; isso não constitui evidência de escrita.
- O código de distribuição bloqueia symlinks inesperados, conflitos de tipo e paths fora do root.

## Governança de seleção de LLM

### Decisões alinhadas

1. O ChatGPT Project, no papel de coordenação/consultoria, recomenda família, modelo e effort por rodada.
2. A recomendação orienta a execução, mas não concede autorização, não obriga o usuário e não constitui gate.
3. O usuário possui decisão final sobre modelo e effort selecionados no Kiro.
4. O executor confia na seleção existente e não realiza uma segunda seleção.
5. A seleção efetiva deve ser registrada antes do preflight.
6. Divergência entre recomendação e seleção efetiva é `USER_SELECTED_ALTERNATIVE`, sem finding, warning ou exigência de justificativa/evidência.
7. O uso de fallback é registrado, mas não precisa provar indisponibilidade do modelo principal.
8. Ausência do registro efetivo pode impedir a conclusão da rodada.
9. Handoffs devem conter recomendação explícita, rationale resumido e alternativa sugerida.
10. Core, políticas universais e Skills permanecem provider-neutral; nomes concretos pertencem a adapters e handoffs.
11. Contract Assurance e Delivery Assurance preservam independência por papel e sessão. Família ou modelo recomendado são complementares, nunca fonte de autoridade.
12. A seleção deve ser definida no início de cada rodada. Não se deve estimular mudança de modelo no meio da mesma sessão quando o Kiro exigir evidência adicional ou quando a troca prejudicar continuidade.

### Contrato conceitual aprovado

O contrato por rodada deve ser composto por:

- `selection_guidance.recommended`;
- `selection_guidance.fallback_guidance`;
- `effective_selection`;
- `comparison_result`.

Valores permitidos:

- `MATCH` — seleção efetiva coincide com a recomendação;
- `USER_SELECTED_ALTERNATIVE` — o usuário selecionou outra opção;
- `FALLBACK_USED` — a alternativa sugerida foi utilizada;
- `NOT_REPORTED` — seleção efetiva não foi registrada.

Somente `NOT_REPORTED` pode gerar bloqueio ou warning material relacionado ao registro do modelo. Os demais valores são estados informativos válidos.

```yaml
selection_guidance:
  recommended:
    family: string
    model: string
    effort: string
    agent_workflow: string
    mode: string
    rationale: string
  fallback_guidance:
    family: string
    model: string
    effort: string
    condition: string
effective_selection:
  family: string
  model: string
  effort: string
  agent_workflow: string
  mode: string
  suggested_alternative_used: boolean
comparison_result: MATCH | USER_SELECTED_ALTERNATIVE | FALLBACK_USED | NOT_REPORTED
```

### Estado atual do enforcement

`policies/CapabilitySelectionPolicy.md` determina seleção por rodada, capability mínima, effort, fallback e resolução concreta por adapter. `tools/lib/adapters.mjs` valida:

- adapters ChatGPT, Codex, Claude e Kiro;
- efforts `LOW`, `MEDIUM`, `HIGH`, `XHIGH` e `MAX`;
- capability e minimum capabilities;
- modelo preferido e fallback distintos;
- nomes concretos confinados aos adapters;
- agente Kiro `Default`;
- `.agentic` canônico e `.kiro` não normativo.

Lacunas confirmadas:

| Superfície | Cobertura atual | Lacuna futura |
|---|---|---|
| Model maps Codex/Claude | capability, effort, preferred e fallback model | guidance por rodada, agente, modo e comparison result |
| Kiro adapter | `Default`, roots e capabilities | registro por rodada |
| Skills | role, phase, referências e estrutura | não registram seleção efetiva |
| Schemas/templates | artifacts, evidence, transition e distribuição | sem contrato de selection guidance |
| Handoff | seções, orçamento e duplicação | sem recommendation/rationale/alternative estruturados |
| Transition validator | topologia, guards e autoridade | sem vínculo ao registro da seleção |
| Preflight | Node/npm | sem verificação de `NOT_REPORTED` |

A evolução futura não deve mover nomes de providers para core, políticas universais ou Skills.

## Inventário e classificação da raiz

As regras abaixo cobrem todos os caminhos atuais. Qualquer caminho novo não abrangido deve ser classificado como `BLOCKED` até decisão explícita.

| Caminho | Classificação | Justificativa |
|---|---|---|
| `.agentic/**` | `KEEP_ACTIVE` | perfil canônico e governança do projeto; não integra runtime package |
| `.kiro/specs/**` | `KEEP_ACTIVE` | artefatos/evidências sob governança; não integra runtime package |
| `AGENTS.md` | `KEEP_ACTIVE` | instruções do repositório; não integra runtime package |
| `Analise_Workflow_v3.0.md` | `ARCHIVE_EXTERNAL` | base histórica; nenhuma remoção autorizada |
| `Kiro_v2_3_source/**` | `ARCHIVE_EXTERNAL` | baseline histórico e Git aninhado |
| `Kiro_v2_4_source/**` | `ARCHIVE_EXTERNAL` | baseline comparativo |
| `framework/adapters/**`, exceto gerados | `KEEP_ACTIVE` | adapters e manifests canônicos |
| `framework/adapters/kiro/generated/**` | `KEEP_GENERATED` | derivados reproduzíveis |
| `framework/contracts/**` | `KEEP_ACTIVE` | schemas, templates e contratos |
| `framework/core/**` | `KEEP_ACTIVE` | workflow tool-neutral |
| `framework/decisions/**` | `KEEP_ACTIVE` | decisões arquiteturais |
| `framework/examples/**` | `KEEP_ACTIVE` | templates de referência |
| `framework/generated/**` | `KEEP_GENERATED` | Skills e relatórios derivados |
| `framework/policies/**` | `KEEP_ACTIVE` | políticas canônicas |
| `framework/skills/**` | `KEEP_ACTIVE` | fontes manuais únicas das Skills |
| `framework/tests/**` | `KEEP_ACTIVE` | validação do repositório |
| `framework/tools/**` | `KEEP_ACTIVE` | validators, generators e lifecycle |
| `framework/package.json` | `KEEP_ACTIVE` | manifest Node |
| `framework/package-lock.json` | `KEEP_ACTIVE` | lock de dependências exatas |
| `framework/framework.lock` | `KEEP_ACTIVE` | integridade interna |
| `framework/agentic-devops-framework-v3-3.0.0.tgz` | `PACKAGE_ONLY` | evidência histórica não confiável; proibido como release candidate |
| `framework/node_modules/**` | `DELETE_AFTER_VALIDATION` | dependências reproduzíveis |
| caches/logs/pacotes temporários futuros | `DELETE_AFTER_VALIDATION` | somente após prova de reprodução |
| qualquer caminho não inventariado | `BLOCKED` | classificação fail-closed |

A classificação expressa destino arquitetural, não autorização. Paths classificados para archive ou exclusão continuam preservados até checkpoints próprios.

### Estado quantitativo observado

- `framework/`: aproximadamente 5 MiB.
- `framework/node_modules/`: aproximadamente 4,1 MiB.
- TGZ local: aproximadamente 80 KiB, 136 entradas.
- SHA-256 observado do TGZ local: `d01e4c89ec081018eec5671b0ad725a1561e8c842b4e51042583c88ae068dca8`.
- Validator de distribuição: 164 fontes lockadas, 64 itens gerenciados e 9 retirements.

Uma evidência histórica anterior registra outro hash para o TGZ. O artefato será preservado em `TicoVillas/AgenticDevOps-History` como evidência histórica não confiável, nunca promovido como release candidate. A release `3.1.0` será reconstruída em ambiente limpo.

## Dependências e archive históricos

### Referências confirmadas

- `framework/tools/lib/reports.mjs` contém referências literais à árvore v2.4.
- `framework/generated/reports/equivalence-v2.4-v3.0.md` materializa essas referências.
- O distribution manifest mantém hashes de nove arquivos legacy derivados do baseline v2.3.
- O runtime não lê diretamente `Kiro_v2_3_source/**`.
- Não foi encontrada referência runtime literal a `Analise_Workflow_v3.0.md`.
- `AGENTS.md` e specs anteriores citam os históricos como fontes preservadas.

### Arquitetura fechada do archive

- destino: repositório privado `TicoVillas/AgenticDevOps-History`;
- retenção: indefinida;
- v2.3: Git bundle completo e verificável, snapshot compactado e manifest de proveniência/hashes por arquivo;
- v2.4 e análise v3.0: snapshots compactados com manifests de proveniência e hashes;
- TGZ atual: evidência histórica não confiável, identificado dessa forma no manifest.

### Gates antes de archive/limpeza

1. comprovar acesso e suporte técnico ao repositório histórico;
2. produzir e verificar manifests de proveniência;
3. verificar Git bundle v2.3 e snapshots compactados;
4. registrar a origem dos nove hashes legacy;
5. substituir dependências operacionais por IDs, hashes ou URIs imutáveis;
6. validar relatórios e equivalência sem presença local;
7. executar teste de restauração integral;
8. obter autorização específica para archive;
9. obter autorização distinta para exclusão local.

## Estrutura canônica recomendada e fechada

O conteúdo atual de `framework/` será promovido para a raiz do repositório privado `TicoVillas/AgenticDevOps`. Os caminhos de governança também pertencem ao repositório, mas são explicitamente excluídos de packages e assets de runtime.

```text
TicoVillas/AgenticDevOps (private)
├── AGENTS.md                       # GOVERNANCE_ONLY; fora do runtime package
├── .agentic/                       # GOVERNANCE_ONLY; fora do runtime package
│   └── **
├── .kiro/
│   └── specs/                      # GOVERNANCE_ONLY; fora do runtime package
│       └── **
├── adapters/
├── contracts/
├── core/
├── decisions/
├── examples/
├── generated/
├── policies/
├── skills/
├── tests/
├── tools/
├── installers/
│   ├── install.sh
│   └── install.ps1
├── release/
│   ├── schemas/
│   ├── templates/
│   └── public-keys/
│       └── release-ed25519.pub
├── .github/workflows/
├── framework.lock
├── package.json
├── package-lock.json
├── SECURITY.md
└── PRIVATE-USE-LICENSE.md          # uso interno, todos os direitos reservados
```

Não integram packages ou assets de runtime:

- `AGENTS.md`;
- `.agentic/**`;
- `.kiro/specs/**`;
- testes e workflows, salvo asset de evidência explicitamente definido;
- fontes históricas e documento de análise;
- `node_modules`;
- TGZ histórico atual;
- receipts, journals, tombstones, backups ou credenciais reais;
- chave privada Ed25519.

## Distribuição por GitHub privado

### Identidade, tags e releases

- repositório privado canônico: `TicoVillas/AgenticDevOps`;
- primeira versão planejada: `3.1.0`;
- branch principal protegida;
- tag oficial exata: `v3.1.0`;
- toda release oficial deve usar tag SemVer exata e imutabilidade;
- se o plano ou a organização não oferecer immutable releases, a publicação oficial permanece `BLOCKED` até aprovação explícita de controle compensatório;
- release vinculada a commit validado;
- nenhum consumo de branch mutável, `raw.githubusercontent.com`, archive de `refs/heads` ou clone como instalação;
- aliases como `stable` podem descobrir uma versão, mas a operação fixa tag, release ID, commit e hashes antes do checkpoint.

Artifact attestations privadas são opcionais e não bloqueantes para `3.1.0`. Quando tecnicamente disponíveis, adicionam provenance, mas não substituem assinatura Ed25519, checksums ou imutabilidade/controle compensatório.

### Assinatura Ed25519

- o release manifest e os checksums serão assinados com Ed25519;
- a chave privada permanece protegida, externa ao repositório e nunca integra packages/assets;
- a chave pública é versionada no repositório e incluída no material necessário à verificação;
- identidade, storage, acesso, rotação, revogação e resposta a comprometimento serão definidos na futura Spec;
- rotação não invalida retrospectivamente releases já verificadas: manifests registram key ID e fingerprint;
- chave revogada bloqueia novas publicações e aciona procedimento explícito de resposta.

### Assets da release `3.1.0`

1. `agentic-devops-framework-v3.1.0.tgz`;
2. `release-manifest-v3.1.0.json`;
3. `release-manifest-v3.1.0.json.sig`;
4. `framework.lock`;
5. `package-lock.json`;
6. `SHA256SUMS`;
7. `SHA256SUMS.sig`;
8. `release-metadata-v3.1.0.json`;
9. `install-v3.1.0.sh`;
10. `install-v3.1.0.ps1`;
11. chave pública Ed25519 e metadata de key ID/fingerprint;
12. SBOM SPDX ou CycloneDX;
13. provenance/attestation, quando disponível;
14. schemas necessários para validação offline.

O release manifest vincula versão, tag, commit, release ID, owner/repo, hashes, tamanhos, runtime mínimo, platform support, installer version, workflow identity, signing key ID/fingerprint, attestation quando disponível e nível de validação por plataforma.

## Instalação sem clone permanente

### Canal e fluxo

Canal principal: GitHub CLI autenticado. Alternativas autorizáveis: API GitHub com fine-grained token read-only e bundle offline previamente verificado.

1. receber tag exata e hash esperado do release manifest;
2. baixar assets para staging temporário com `gh release download` autenticado;
3. se necessário, usar API GitHub com token fine-grained somente leitura ou bundle offline verificado;
4. nunca executar `curl | sh` ou script remoto não verificado;
5. verificar assinatura Ed25519, manifest e checksums antes da extração;
6. rejeitar path traversal, symlinks e conflitos de tipo;
7. executar `npm ci --ignore-scripts` somente no staging verificado;
8. chamar uma CLI Node canônica;
9. produzir snapshot e plano antes de qualquer mutação;
10. apresentar checkpoint humano;
11. aplicar somente sob autorização separada;
12. guardar state, backups e receipts fora de `~/.kiro`;
13. remover apenas staging efêmero quando seguro.

State recomendado:

- Linux: `${XDG_STATE_HOME:-$HOME/.local/state}/agentic-devops/`;
- Windows: `%LOCALAPPDATA%\AgenticDevOps\State\`.

### Primeiro alvo validável: Linux

- arquitetura: x86-64;
- shell: Bash 5 ou superior;
- runtime: Node.js 24;
- package manager: npm compatível com o lock validado;
- status: alvo de primeira implementação e fresh-install validation, ainda não executado.

`install.sh` será bootstrap fino: valida ferramentas, obtém/verifica a release e delega regras à CLI Node. Nenhum installer Linux existe ou foi executado nesta descoberta.

### Alvo projetado: Windows

- sistema: Windows 11;
- shell: PowerShell 7.4 ou superior;
- status: arquitetura projetada, não validada.

`install.ps1` seguirá o mesmo protocolo, com `Get-FileHash`, contenção de paths, state externo e tratamento de ACL/atomicidade. Não se declara suporte Windows validado antes de execução em host Windows real.

## Lifecycle operacional

### Install

- receipt anterior ausente;
- criar apenas paths ausentes;
- bloquear colisões não gerenciadas;
- exigir backup para substituições e retirements;
- preservar backup original da primeira instalação enquanto o framework estiver instalado;
- escrever self-update por último;
- retornar `RESTART_REQUIRED`;
- executar Stage B em nova execução.

### Update

- exigir receipt final anterior;
- vincular versão origem/destino e hashes;
- aceitar `MANAGED_OUTDATED` somente para hash conhecido;
- bloquear divergência gerenciada;
- produzir backup e rollback antes da aplicação;
- manter backups de três versões bem-sucedidas por no mínimo 90 dias;
- resolver qualquer channel para release exata antes da autorização.

### Reconcile/resume

- journal intent-first;
- observar filesystem antes de retomar;
- distinguir `FAILED_KNOWN`, `PARTIAL` e `UNKNOWN`;
- nunca repetir efeito desconhecido;
- nunca remover backup de operação `UNKNOWN`, `PARTIAL` ou não reconciliada;
- exigir snapshot e autorização atuais.

### Rollback

- derivado de journal e receipt;
- remoção de criação protegida por after-hash;
- restauração somente de backup verificado;
- autorização própria;
- receipt próprio.

### Uninstall

O uninstall futuro terá planner, manifest, journal e receipt próprios e obedecerá a semântica fechada:

- restaura o estado anterior somente nos paths gerenciados pelo framework;
- remove criação somente se o hash atual ainda for gerenciado e esperado;
- restaura substituição somente de backup verificado;
- preserva integralmente conteúdo não gerenciado;
- preserva qualquer path modificado pelo usuário e o reporta para decisão;
- mantém tombstone indefinidamente;
- mantém backups por 30 dias após uninstall, salvo retenção manual;
- não remove backup de operação `UNKNOWN`, `PARTIAL` ou não reconciliada.

### Retenção transversal

- receipts, journals e tombstones: indefinidos;
- backup original: durante toda a instalação;
- backups de update: três versões bem-sucedidas e pelo menos 90 dias;
- pós-uninstall: tombstone indefinido e backups por 30 dias, salvo retenção manual.

## `PROJECT_UPDATE`

`PROJECT_UPDATE` permanece separado do lifecycle global por alterar outro root, poder interagir com Git e conter configuração específica do projeto.

Artefatos recomendados:

- `project-update-manifest.schema.yaml`;
- `project-update-plan.schema.yaml`;
- `project-update-journal.schema.yaml`;
- `project-update-receipt.schema.yaml`;
- backup manifest próprio.

Campos mínimos:

- operation ID;
- release/tag/commit/package/lock hashes;
- project root realpath;
- snapshot hash;
- Git root, branch, HEAD e status digest quando aplicável;
- allowlist sob `.agentic`;
- estados before/after;
- ownership e origem;
- regras de merge;
- symlink/type checks;
- backup set e rollback preview;
- autorização/expiração;
- operações Git solicitadas/autorizadas;
- ações não executadas.

Regras fechadas:

- o planner propõe mudanças por padrão e não aplica durante planejamento;
- toda aplicação exige checkpoint explícito e autorização corrente;
- `application-profile.yaml` nunca é alterado silenciosamente;
- arquivo mantido pelo usuário requer merge/proposta visível ou permanece inalterado;
- templates servem para criação inicial, não como autoridade sobre perfil existente;
- migrações são versionadas e field-aware;
- `.kiro` permanece compatibilidade não normativa;
- Git, commit e push exigem autorizações próprias;
- receipt de projeto não substitui receipt global.

## Pipeline de validação e publicação

### Pull request

1. Node 24 e npm compatível com o lock;
2. `npm ci --ignore-scripts`;
3. `npm run validate`;
4. `npm test`;
5. regeneração com diff zero;
6. validação de `framework.lock`;
7. package allowlist excluindo `AGENTS.md`, `.agentic/**` e `.kiro/specs/**`;
8. ausência de históricos, segredos e chave privada Ed25519 nos assets;
9. revisão de dependências e política privada de uso interno;
10. testes de extração/contenção e installers sintéticos.

### Release candidate `3.1.0`

1. exigir `package.json.version == 3.1.0` e tag `v3.1.0`;
2. exigir commit aprovado da branch protegida;
3. gerar package em runner limpo e efêmero, nunca reutilizando o TGZ histórico;
4. comparar duas builds para identidade lógica/reprodutibilidade;
5. gerar manifest, lock, checksums, SBOM e installers;
6. assinar manifest e checksums com Ed25519;
7. verificar que a chave privada não integra repositório, logs ou assets;
8. gerar attestation somente quando disponível, sem bloquear `3.1.0`;
9. criar draft release;
10. verificar suporte a immutable release;
11. se indisponível, bloquear publicação até aprovação explícita de controle compensatório;
12. obter checkpoint humano independente;
13. publicar release imutável ou sob o controle compensatório aprovado;
14. baixar novamente os assets publicados e verificar assinatura/hashes.

### Fresh-install validation

Gates separados:

- Linux x86-64/Bash 5+/Node 24/npm compatível: fresh install comprovado;
- Linux update/reconcile/rollback/uninstall;
- Windows 11/PowerShell 7.4+: fresh install em host real antes de declarar suporte;
- Windows update/reconcile/rollback/uninstall;
- pilot `PROJECT_UPDATE`.

Nenhuma plataforma é declarada validada apenas com arquitetura projetada ou testes sintéticos.

## Licenciamento

O estado `UNLICENSED` será substituído por política privada de uso interno, todos os direitos reservados. O repositório, packages e release metadata devem expressar consistentemente essa política. A redação e o arquivo canônico serão definidos na futura Spec, sem abrir a decisão de modelo de licenciamento.

## Gates objetivos remanescentes

Não são dúvidas arquiteturais; são verificações objetivas antes das operações correspondentes:

1. confirmar disponibilidade e permissões de `TicoVillas/AgenticDevOps` e `TicoVillas/AgenticDevOps-History`;
2. confirmar suporte do plano/organização GitHub a immutable releases ou obter aprovação explícita de controle compensatório;
3. validar acesso autenticado via GitHub CLI e, se usado, token fine-grained read-only;
4. validar assinatura/verificação Ed25519 e proteção da chave privada;
5. validar release reconstruída em ambiente limpo;
6. executar fresh install Linux no alvo definido;
7. executar em host Windows real antes de declarar suporte Windows;
8. testar restauração integral do archive histórico;
9. comprovar preservação integral do workspace anterior antes da limpeza.

## Riscos

1. recomendação de modelo ser interpretada incorretamente como autoridade ou gate;
2. ausência de registro efetivo encerrar rodada sem rastreabilidade;
3. fallback silencioso alterar continuidade sem registro;
4. tag ou release mutável permitir substituição de supply chain;
5. publicação sem imutabilidade nativa nem controle compensatório aprovado;
6. checksum/manifest sem verificação Ed25519 confiável;
7. comprometimento, perda ou rotação incorreta da chave privada;
8. hash do TGZ histórico divergente de evidência anterior;
9. archive sem teste de restauração;
10. perda do Git v2.3;
11. exclusão antes de release/fresh install verificáveis;
12. dependência do registry npm no staging;
13. vazamento de token GitHub;
14. concorrência com outro writer;
15. escrita após self-update;
16. rollback contra estado stale;
17. suporte PowerShell alegado sem host Windows;
18. `PROJECT_UPDATE` aplicar sem checkpoint ou sobrescrever configuração local;
19. mistura de receipts global e de projeto;
20. remoção prematura de backups de operação não reconciliada.

## Milestones e checkpoints humanos

1. **M0 — Governança fechada:** repositórios, layout, versão, licença, assinatura e targets definidos neste discovery.
2. **M1 — Selection record:** contrato, handoff e validação de `NOT_REPORTED`.
3. **M2 — Proveniência histórica:** `TicoVillas/AgenticDevOps-History`, Git bundle v2.3, snapshots, manifests e restauração testada.
4. **M3 — Release contracts:** manifest, metadata, Ed25519, checksums e SBOM.
5. **M4 — Lifecycle CLI:** install/update/reconcile/rollback/uninstall e retenção fechada.
6. **M5 — `PROJECT_UPDATE`:** planner, manifest, journal, receipt e checkpoint obrigatório.
7. **M6 — Installers:** Linux primeiro; PowerShell projetado até validação real.
8. **M7 — CI:** validação, empacotamento e supply-chain controls.
9. **M8 — Git local:** somente sob autorização específica.
10. **M9 — GitHub privado:** criação/configuração/push/rulesets sob autorização separada.
11. **M10 — Publicação `3.1.0`:** draft, imutabilidade ou controle compensatório, assinatura e checkpoint.
12. **M11 — Fresh install Linux:** comprovação no alvo x86-64/Bash 5+/Node 24.
13. **M12 — Validação Windows:** somente em host Windows 11/PowerShell 7.4+ real.
14. **M13 — Limpeza local, último milestone:** somente após archive restaurável, release verificável, fresh install Linux comprovado e preservação integral do workspace anterior.

Autorizações independentes obrigatórias:

- archive/cópia externa;
- exclusão local;
- inicialização e commits Git;
- criação/configuração GitHub;
- push/tag;
- publicação de release;
- aprovação de eventual controle compensatório de imutabilidade;
- fresh install global;
- rollback real;
- uninstall real;
- pilot `PROJECT_UPDATE`.

## Evidências e validações disponíveis

Executadas no discovery original, sem alteração das fontes canônicas:

- `npm run validate:adapters` — PASS, 4 adapters e 4 model mappings;
- `npm run validate:handoff` — PASS, 139 palavras e nenhuma duplicação;
- `npm run validate:distribution` — PASS, 164 fontes/locks, 64 managed items e 9 retirements;
- inventário, Git state, permissões, symlinks de primeiro nível e writers — read-only.

Não executados:

- `npm test` completo;
- reconstrução/publicação do pacote;
- assinatura Ed25519 real;
- installer Linux ou PowerShell;
- Stage A/B real e restart;
- instalação/atualização global;
- rollback/uninstall real;
- Git/GitHub/release;
- fresh-install validation;
- `PROJECT_UPDATE`.

## Recomendação de abordagem

A mudança futura é transversal, de alto risco operacional e envolve supply chain, multiplataforma, lifecycle destrutivo e contratos persistentes. A modalidade recomendada, somente após aprovação posterior, é uma **Spec completa**. Esta recomendação não inicia nem autoriza a fase.

O discovery alinhado está finalizado para confirmação humana. Nenhuma implementação ou operação externa foi executada.

**Status final: `APPROVED_FOR_SPEC`**
