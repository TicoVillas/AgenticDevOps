# Requirements — Framework Governance and Portability

## Identificação

- **Status:** `DRAFT_READY_FOR_CONTRACT_REVIEW`
- **Fase:** `spec/round-01`
- **Papel:** `ENGINEERING`
- **Modalidade:** Spec completa, requirements-first
- **Slug:** `framework-governance-and-portability`
- **Linha:** `engineering-author/framework-governance-and-portability`
- **Origem:** `discovery.md` `APPROVED_FOR_SPEC`
- **Assurance:** `HIGH_RISK`
- **Fonte canônica atual:** `/home/villas/Projects/AgenticDevOps/framework`

## Objetivo

Evoluir o framework para uma distribuição privada, verificável e portável na versão `3.1.0`, mantendo uma única fonte de verdade, registrando selection guidance sem retirar a autoridade do usuário, estabelecendo archive histórico restaurável, supply chain assinada, lifecycle global fail-closed, `PROJECT_UPDATE` separado, installers equivalentes e limpeza somente após gates comprovados.

## Atores e autoridade

- **CONSULTING / ChatGPT Project:** recomenda família, modelo e effort e coordena alinhamento; não autoriza operação.
- **ENGINEERING:** especifica, implementa e corrige; não revisa nem valida independentemente a própria entrega.
- **CONTRACT_ASSURANCE:** revisa este contrato em sessão independente.
- **DELIVERY_ASSURANCE:** valida a implementação em sessão independente.
- **Usuário:** decide modelo/effort e concede cada autorização material.
- **Operador de release:** atua sob checkpoint específico e menor privilégio; não herda autoridade da implementação.

## Requisitos funcionais

### Selection guidance e effective selection

- **SEL-001 — Guidance por rodada:** cada rodada deve poder registrar `selection_guidance.recommended` com família, modelo, effort, agente/workflow, modo e rationale resumido.
- **SEL-002 — Alternativa sugerida:** `selection_guidance.fallback_guidance` deve registrar família, modelo, effort e condição orientativa, sem constituir obrigação.
- **SEL-003 — Autoridade do usuário:** a seleção manual do usuário deve prevalecer; o executor não deve reavaliar, substituir ou exigir justificativa/evidência por divergência.
- **SEL-004 — Registro pré-preflight:** `effective_selection` deve registrar família, modelo, effort, agente/workflow, modo e uso da alternativa antes do preflight.
- **SEL-005 — Comparação fechada:** `comparison_result` deve aceitar somente `MATCH`, `USER_SELECTED_ALTERNATIVE`, `FALLBACK_USED` ou `NOT_REPORTED`.
- **SEL-006 — Único bloqueio:** somente `NOT_REPORTED` pode impedir conclusão ou produzir warning material por ausência de rastreabilidade de seleção.
- **SEL-007 — Divergência válida:** `USER_SELECTED_ALTERNATIVE` não deve gerar finding, warning nem pedido de justificativa.
- **SEL-008 — Fallback informativo:** `FALLBACK_USED` deve ser registrado sem exigir prova de indisponibilidade do recomendado.
- **SEL-009 — Handoff:** handoffs devem conter recomendação explícita, rationale resumido e alternativa sugerida.
- **SEL-010 — Provider-neutrality:** core, políticas universais e Skills não podem conter nomes concretos de providers/modelos; esses nomes ficam confinados a adapters e handoffs.
- **SEL-011 — Assurance independente:** independência deve derivar de papel e sessão, nunca de família/modelo.
- **SEL-012 — Continuidade:** a seleção deve ser definida no início da rodada; mudança no meio da mesma sessão não deve ser estimulada quando prejudicar continuidade ou exigir evidência adicional do Kiro.

### Repositório canônico

- **REP-001 — Repositório:** o repositório privado canônico deve ser `TicoVillas/AgenticDevOps`.
- **REP-002 — Promoção de layout:** o conteúdo atual de `framework/` deve ser promovido para a raiz de um novo checkout em diretório irmão, sem reorganização destrutiva in-place.
- **REP-003 — Governança versionada:** `AGENTS.md`, `.agentic/**` e `.kiro/specs/**` devem integrar o repositório.
- **REP-004 — Exclusão de runtime:** os três caminhos de governança devem ser excluídos de packages e assets de runtime por allowlist verificável.
- **REP-005 — Versão:** a primeira versão planejada deve ser `3.1.0` e a tag oficial `v3.1.0`.
- **REP-006 — Uso privado:** package, repositório e release metadata devem declarar política privada de uso interno, todos os direitos reservados, substituindo `UNLICENSED`.
- **REP-007 — Conteúdo proibido:** chave privada, segredos, state operacional real, receipts, journals, tombstones e backups reais não podem integrar o repositório ou runtime assets.
- **REP-008 — Fonte única:** fontes manuais, gerados, manifests e locks devem preservar ownership único; gerados não podem se tornar fonte normativa.
- **REP-009 — Preservação:** o workspace atual permanece íntegro até o último milestone de limpeza.

### Archive histórico

- **ARC-001 — Destino:** o archive deve usar o repositório privado `TicoVillas/AgenticDevOps-History`.
- **ARC-002 — Retenção:** o archive histórico deve ter retenção indefinida.
- **ARC-003 — v2.3 Git:** a v2.3 deve ser preservada em Git bundle completo e verificável.
- **ARC-004 — Snapshots:** v2.3, v2.4 e a análise v3.0 devem possuir snapshots compactados determinísticos.
- **ARC-005 — Proveniência:** cada conjunto deve ter manifest com origem, timestamps, algoritmo, hash e tamanho por arquivo, além do hash do archive.
- **ARC-006 — TGZ histórico:** o TGZ atual deve ser arquivado como evidência histórica não confiável e nunca aceito como release candidate.
- **ARC-007 — Verificação:** bundles, snapshots e manifests devem ser verificados após upload e novamente após redownload.
- **ARC-008 — Restauração:** restauração integral deve ser testada em root isolado antes de qualquer limpeza local.
- **ARC-009 — Dependências:** referências operacionais aos históricos devem ser substituídas por IDs, hashes ou URIs imutáveis antes da remoção local.
- **ARC-010 — Autorização separada:** archive, upload, restauração de teste e remoção local são operações distintas; nenhuma autoriza a seguinte.

### Release contracts e supply chain

- **REL-001 — Tag exata:** release oficial deve usar tag SemVer exata e vinculada a commit aprovado.
- **REL-002 — Imutabilidade:** publicação oficial exige immutable release; se indisponível, fica `BLOCKED` até controle compensatório explicitamente aprovado.
- **REL-003 — Manifest:** `release-manifest-v3.1.0.json` deve registrar versão, tag, commit, release ID, repositório, assets, hashes, tamanhos, locks, runtime, platform support, build identity e estado de validação.
- **REL-004 — Checksums:** `SHA256SUMS` deve abranger todos os assets publicados.
- **REL-005 — Ed25519:** release manifest e checksums devem possuir assinaturas Ed25519 separadas e verificáveis.
- **REL-006 — Chave privada:** a chave privada deve permanecer fora de repo, package, assets e logs, protegida por mecanismo aprovado e acesso mínimo.
- **REL-007 — Chave pública:** chave pública, key ID, algoritmo e fingerprint devem ser versionados e distribuídos por canal verificável.
- **REL-008 — Rotação:** o contrato deve definir geração, ativação e período de sobreposição de chaves sem invalidar releases históricas válidas.
- **REL-009 — Revogação:** revogação deve bloquear novas assinaturas/verificações conforme política e publicar metadata de revogação autenticada.
- **REL-010 — Comprometimento:** resposta deve incluir hard stop, revogação, avaliação de releases, nova chave e comunicação de impacto.
- **REL-011 — SBOM:** a release deve incluir SBOM SPDX ou CycloneDX vinculada por hash.
- **REL-012 — Attestation opcional:** artifact attestation privada é complementar e não bloqueante para `3.1.0`.
- **REL-013 — Build limpo:** package deve ser reconstruído em runner limpo/efêmero; o TGZ histórico é proibido como entrada.
- **REL-014 — Reprodutibilidade:** duas builds do mesmo commit/lock devem produzir identidade lógica equivalente; diferenças devem ser explicadas e bloqueiam publicação enquanto materiais.
- **REL-015 — Allowlist:** package deve ser construído por allowlist e rejeitar governança, históricos, segredos, chave privada e state real.
- **REL-016 — Redownload:** após publicação, assets devem ser baixados novamente e ter assinatura, hashes, tamanhos e bindings reverificados.
- **REL-017 — Branch mutável proibida:** instalação não pode consumir branch, `raw.githubusercontent.com`, `refs/heads`, tag móvel não resolvida ou clone.
- **REL-018 — Draft/checkpoint:** release deve permanecer draft até validação completa e checkpoint humano independente.

### Installer sem clone

- **INS-001 — Canal principal:** GitHub CLI autenticado deve ser o canal principal.
- **INS-002 — API alternativa:** API GitHub só pode usar fine-grained token read-only, sem exposição em argumentos/logs.
- **INS-003 — Offline:** bundle offline deve conter manifest, assinaturas, checksums, chave pública e assets, todos previamente verificáveis.
- **INS-004 — Versão fixa:** installer deve exigir ou resolver uma versão exata e registrar tag, release ID, commit e hashes antes do plano.
- **INS-005 — Staging:** downloads e dependências devem residir em staging efêmero, exclusivo e externo ao destino global.
- **INS-006 — Verify-before-extract:** assinatura, manifest, checksums e tamanhos devem ser validados antes da extração.
- **INS-007 — Extração segura:** path traversal, paths absolutos, separadores inválidos, colisão case-fold, devices e tipos não regulares devem ser rejeitados.
- **INS-008 — Symlink:** symlinks em fonte, staging ou ancestry/destino gerenciado devem bloquear a operação.
- **INS-009 — Conflitos:** arquivo/diretório/tipo inesperado deve bloquear, sem sobrescrita inferida.
- **INS-010 — Sem pipe remoto:** `curl | sh`, `iex` remoto ou execução de conteúdo remoto não verificado são proibidos.
- **INS-011 — CLI canônica:** shell/PowerShell devem ser bootstraps finos e delegar semântica a uma CLI Node canônica.
- **INS-012 — State externo:** state, locks, backups, journals, receipts e tombstones devem ficar fora de `~/.kiro` e do package staging.
- **INS-013 — Cleanup seguro:** somente temporários owned e reconciliados podem ser removidos.
- **INS-014 — Credenciais:** tokens não podem ser persistidos no state nem incluídos em evidência.

### Lifecycle global

- **LIF-001 — Operações:** a CLI deve separar `inspect`, `plan`, `install`, `update`, `reconcile`, `resume`, `rollback`, `uninstall` e `verify`.
- **LIF-002 — Snapshot:** toda mutação deve depender de snapshot atual, hashado e ligado ao plan.
- **LIF-003 — Planner fail-closed:** estado desconhecido, divergente, não gerenciado, symlink, conflito de tipo, hash de fonte inválido ou path externo deve produzir `BLOCKED`.
- **LIF-004 — Separação:** planejamento nunca autoriza mutação; apply exige autorização vigente ligada a operation ID, plan hash e snapshot hash.
- **LIF-005 — Journal intent-first:** intenção durável deve ser gravada e sincronizada antes de cada efeito material.
- **LIF-006 — Receipts:** receipt final deve vincular release/manifest/lock/package/snapshot/plan/journal, before/after hashes e resultado observado.
- **LIF-007 — Tombstones:** uninstall e operações destrutivas devem produzir tombstone persistente.
- **LIF-008 — Idempotência:** repetição de operação concluída deve retornar `NO_CHANGE`; repetição de estado incerto deve bloquear.
- **LIF-009 — UNKNOWN/PARTIAL:** efeito `UNKNOWN`, `PARTIAL` ou não reconciliado não pode ser repetido, limpo nem ter backups removidos.
- **LIF-010 — Reconcile:** reconciliação deve observar estado real e produzir somente `READY_TO_RESUME`, `NO_CHANGE` ou `BLOCKED`, sem mutar.
- **LIF-011 — Resume:** resume só pode continuar journal reconciliado, snapshot atual e autorização renovada.
- **LIF-012 — Rollback:** deve verificar after-hash e backup; criação é removida somente se ainda idêntica ao aplicado.
- **LIF-013 — Install:** cria ausentes, bloqueia colisões e preserva backup original de conteúdo substituído durante toda a instalação.
- **LIF-014 — Update:** atualiza apenas hash gerenciado conhecido e mantém backups de três versões bem-sucedidas por no mínimo 90 dias.
- **LIF-015 — Uninstall:** restaura somente paths gerenciados, preservando conteúdo não gerenciado ou modificado pelo usuário.
- **LIF-016 — Pós-uninstall:** tombstone tem retenção indefinida; backups permanecem 30 dias salvo retenção manual.
- **LIF-017 — Retenção:** receipts, journals e tombstones têm retenção indefinida; regras de purge devem ser determinísticas e auditáveis.
- **LIF-018 — Self-update:** self-update deve ser a última escrita, fechar write guard, retornar `RESTART_REQUIRED` e impedir efeitos posteriores.
- **LIF-019 — Stage B:** pós-restart ocorre em nova execução read-only antes de finalizar receipt.
- **LIF-020 — Lock de operação:** deve existir lock exclusivo por destination root/operation class com detecção de stale lock sem quebra automática insegura.

### PROJECT_UPDATE

- **PRJ-001 — Contratos próprios:** `PROJECT_UPDATE` deve possuir manifest, plan, journal, receipt e backup manifest próprios.
- **PRJ-002 — Receipts separados:** receipt de projeto não pode substituir ou compartilhar identidade com receipt global.
- **PRJ-003 — Root:** project root deve ser absoluto, realpath verificado e distinto de staging/state/global root.
- **PRJ-004 — Allowlist:** mutações devem ficar sob `.agentic/**`, salvo futura decisão versionada e revisada.
- **PRJ-005 — Proposta padrão:** planner deve produzir proposta sem mutação.
- **PRJ-006 — Checkpoint:** qualquer aplicação exige checkpoint explícito e autorização vigente ligada ao plan/snapshot.
- **PRJ-007 — Perfil protegido:** `application-profile.yaml` nunca pode ser alterado silenciosamente; divergência exige proposta de merge visível ou preservação.
- **PRJ-008 — Migrações:** migrações devem ter ID/versão, precondições, transformação field-aware, reversão e fixtures.
- **PRJ-009 — Git separado:** leitura Git pode informar snapshot; staging, commit, push e demais writes exigem autorizações próprias.
- **PRJ-010 — Segurança:** aplicar contenção, symlink/type guards, backup, journal intent-first, reconcile e rollback equivalentes ao lifecycle global.
- **PRJ-011 — Não acoplamento:** falha ou ausência de `PROJECT_UPDATE` não pode invalidar receipt global já finalizado.

### Targets de plataforma

- **PLT-001 — Linux inicial:** primeiro alvo validável é Linux x86-64, Bash 5+, Node.js 24 e npm compatível com lock.
- **PLT-002 — Windows projetado:** alvo projetado é Windows 11 e PowerShell 7.4+.
- **PLT-003 — Claim:** suporte Windows não pode ser declarado validado sem execução em host real.
- **PLT-004 — Equivalência:** installers devem produzir os mesmos plans, bindings, decisões, stop conditions e semântica de receipt para estado equivalente.
- **PLT-005 — Diferenças explícitas:** permissions, ACL, atomic rename, case folding e metadata não aplicável devem ser modelados por plataforma.
- **PLT-006 — Runtime ausente:** installer não instala/atualiza Node automaticamente; ausência/incompatibilidade retorna `NEEDS_STATE_VALIDATION`.
- **PLT-007 — Evidência graduada:** capabilities devem ser classificadas como `PROJECTED`, `SYNTHETICALLY_VALIDATED` ou `VALIDATED_ON_HOST`.

### Pipeline e GitHub

- **CICD-001 — PR:** toda mudança deve executar install lockado, validators, testes e scans sem scripts de dependência.
- **CICD-002 — Generated drift:** regeneração deve produzir diff zero.
- **CICD-003 — Lock:** `framework.lock` e package lock devem ser completos, coerentes e sem drift.
- **CICD-004 — Package policy:** allowlist deve ser testada positiva e negativamente.
- **CICD-005 — Secrets:** pipeline deve detectar segredos, tokens e material de chave privada e bloquear.
- **CICD-006 — Reprodutibilidade:** build dupla deve ser comparada antes do draft.
- **CICD-007 — Least privilege:** workflows e tokens devem usar permissões mínimas; actions devem ser pinadas por commit.
- **CICD-008 — Draft:** pipeline automatizado só pode criar/atualizar draft antes do checkpoint.
- **CICD-009 — Review independente:** publicação exige checkpoint humano independente dos writers da build.
- **CICD-010 — Imutabilidade gate:** suporte a immutable release ou controle compensatório aprovado deve ser verificado antes de publish.
- **CICD-011 — Redownload:** release publicada deve passar reverificação por download externo ao job de build.
- **CICD-012 — Protection:** branch principal e tags devem usar rulesets/protection compatíveis com review e status checks.
- **CICD-013 — Operações distintas:** init Git, commit, remote, push, tag, draft e publish são autorizações distintas.
- **CICD-014 — No untrusted execution:** conteúdo de PR/fork não pode obter signing key ou token de publicação.
- **CICD-015 — Evidência:** pipeline deve produzir evidence index sanitizado com commit, jobs, hashes, resultados e limitações.

### Limpeza e migração de layout

- **CLN-001 — Diretório irmão:** o novo checkout deve ser construído em diretório irmão, nunca por move/delete in-place.
- **CLN-002 — Cópia allowlisted:** promoção de `framework/` e inclusão de governança devem usar manifest de migração com source/destination/hash/classificação.
- **CLN-003 — Comparação:** novo checkout deve ser comparado com fonte canônica e package allowlist antes de Git.
- **CLN-004 — Último milestone:** limpeza local deve ser a última operação do programa.
- **CLN-005 — Gates:** limpeza exige archive restaurável, release verificável, fresh install Linux comprovado e preservação integral do workspace anterior.
- **CLN-006 — Autorização:** cada path a remover deve constar de plan final e autorização específica; divergência bloqueia.

## Requisitos não funcionais

- **NFR-001 — Determinismo:** mesmos inputs, versões e plataforma normalizada produzem mesmo plan/decisão/hash lógico.
- **NFR-002 — Fail-closed:** ausência, invalidade, ambiguidade ou divergência material bloqueia.
- **NFR-003 — Auditabilidade:** operações são reconstruíveis por manifests, hashes, journals, receipts e evidence index sem conversa.
- **NFR-004 — Segurança:** menor privilégio, segredo protegido, boundary validation, defaults seguros e logs sanitizados.
- **NFR-005 — Portabilidade:** semântica permanece na CLI/core; wrappers de plataforma não divergem.
- **NFR-006 — Atomicidade:** writes usam temp sibling, sync, atomic replace quando suportado e verificação pós-write.
- **NFR-007 — Concorrência:** um writer por root; lock contention bloqueia sem retry destrutivo.
- **NFR-008 — Observabilidade:** eventos estruturados têm operation ID, fase, code, path lógico, resultado e sanitização; nunca token/conteúdo sensível.
- **NFR-009 — Dependências:** nenhuma dependência nova é introduzida sem justificativa, pin exato e aprovação futura.
- **NFR-010 — Compatibilidade:** comportamento v3.0 consolidado é preservado ou mudança é explícita, testada e rastreada.

## Regras de negócio

- **BR-001:** recomendação, modelo, modo e Autopilot não concedem autorização.
- **BR-002:** drafts e Contract Review não autorizam implementação ou operação real.
- **BR-003:** planning, simulation, local write, destructive local, remote write e global operation são classes separadas.
- **BR-004:** estado real e artefatos canônicos prevalecem sobre relato.
- **BR-005:** primeiro Contract Review e primeira Delivery Validation usam sessões independentes.
- **BR-006:** operação incerta para e preserva evidência; não há retry cego.
- **BR-007:** uma regra normativa possui uma fonte de verdade; consumidores referenciam-na.

## Critérios de aceite

- **ACC-001 (SEL):** fixtures para os quatro `comparison_result` passam; apenas `NOT_REPORTED` bloqueia; scan rejeita provider names em core/policies/Skills.
- **ACC-002 (REP):** manifest do novo checkout prova layout raiz, presença dos três caminhos de governança e ausência deles no package/runtime assets.
- **ACC-003 (ARC):** Git bundle v2.3 verifica, archives redownloaded conferem e restauração isolada reproduz hashes por arquivo.
- **ACC-004 (REL):** release candidate limpo produz manifest/checksums assinados; adulteração de asset, manifest, assinatura, key ID ou fingerprint falha.
- **ACC-005 (REL):** pipeline bloqueia publish sem immutable release ou controle compensatório aprovado.
- **ACC-006 (INS):** branch URL, `curl | sh`, traversal, symlink, type conflict e checksum inválido são rejeitados antes de execução.
- **ACC-007 (LIF):** install/update/reconcile/resume/rollback/uninstall têm fixtures positivas, negativas e recovery; retry de `UNKNOWN/PARTIAL` bloqueia.
- **ACC-008 (LIF):** self-update é a última escrita, retorna `RESTART_REQUIRED` e Stage B requer nova execução.
- **ACC-009 (RETENTION):** testes de relógio provam 3 versões + 90 dias, 30 dias pós-uninstall e retenção indefinida dos registros.
- **ACC-010 (PRJ):** planner de projeto é read-only, apply sem checkpoint falha e `application-profile.yaml` divergente permanece inalterado.
- **ACC-011 (PLT):** Linux passa em host real; Windows permanece `PROJECTED` até evidência real; testes de contrato comparam planos das duas plataformas.
- **ACC-012 (CICD):** PR falha com generated drift, lock drift, path fora da allowlist, segredo ou chave privada.
- **ACC-013 (CICD):** build dupla é equivalente, draft recebe checkpoint e redownload pós-publish confere.
- **ACC-014 (CLN):** nenhum path do workspace anterior é removido antes dos quatro gates e da autorização final por path.
- **ACC-015 (SEC):** logs/evidências não contêm tokens, private key, prompts integrais ou paths sensíveis desnecessários.
- **ACC-016 (TRACE):** cada requisito possui design, task, teste e evidência esperada; nenhuma task material fica sem requirement.
- **ACC-017 (SCOPE):** implementação não altera históricos durante construção e não executa Git/GitHub/release/global sem autorização da operação.
- **ACC-018 (LICENSE):** repo, package e release metadata expressam uso privado/todos os direitos reservados e não contêm `UNLICENSED`.

## Estratégia de validação

- schemas com fixtures positivas e negativas por campo/enum/binding;
- unit tests de planners, state machines, locks, paths, assinatura e retenção;
- property/table tests para classificação de estado e idempotência;
- integração em roots temporários injetados, sem global real;
- fault injection before/after write, sync, rename, receipt e restart;
- contract tests entre CLI e installers Linux/PowerShell;
- pipeline tests para allowlist, segredo, key material e mutable source;
- restore drill do archive;
- fresh-install Linux real antes de limpeza;
- validação Windows real em milestone independente;
- matriz `requirement → design → task → test → evidence`.

## Fora do escopo desta Spec draft

- implementar ou modificar `framework/**` nesta rodada;
- criar novo checkout, archive, Git ou repositório GitHub;
- assinar, publicar ou instalar;
- executar `PROJECT_UPDATE`, rollback, uninstall ou limpeza real;
- declarar suporte Windows validado;
- adicionar dependência sem revisão futura.

## Rastreabilidade por domínio

| IDs | Design esperado | Milestones |
|---|---|---|
| SEL-* | Selection record e handoff | M1 |
| REP-* | Layout e package policy | M2, M9 |
| ARC-* | Archive/provenance | M3 |
| REL-* | Release contracts/Ed25519 | M4, M8, M12 |
| INS-* | CLI e installers | M5, M7 |
| LIF-* | Lifecycle/state machines | M5 |
| PRJ-* | PROJECT_UPDATE | M6 |
| PLT-* | Platform abstraction | M7, M13, M14 |
| CICD-* | CI/GitHub/release | M8–M12 |
| CLN-* | Checkout e limpeza | M9, M15 |
| NFR-*, BR-* | Transversal | todos |

Nenhuma decisão material permanece aberta; indisponibilidade técnica, validação em host e suporte do plano GitHub são gates verificáveis.
