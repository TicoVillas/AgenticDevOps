# Correction Spec — VAL-GBL-001 (Global Skills missing required `description`)

## Identificação

- **Origem:** `evidence/validation/round-02/VALIDATION.md` (SECOND_OPINION, `FAILED`)
- **Finding:** VAL-GBL-001 — as dez `SKILL.md` não possuem o campo obrigatório `description`
- **Slug:** framework-v3-global-bootstrap-layout
- **Operation ID relatado:** `bootstrap-v3-20260802162347283-4c5efab1`
- **Fase candidata de execução:** `correct-from-validation`
- **Sessão de execução futura:** retomar `engineering-author/framework-v3`
- **Data:** 2026-08-02

## Status

```
VALIDATED
```

## Ledger

- `VAL-GBL-001 = RESOLVED` — `RESOLVED_IN_CORRECTED_DISTRIBUTION`.
- `GLOBAL_REMEDIATION_PENDING`: pacote corrigido `d01e4c89ec081018eec5671b0ad725a1561e8c842b4e51042583c88ae068dca8` ainda **não aplicado**; nova operação global obrigatória; receipt histórico permanece `PRE_RESTART_PENDING`.
- Revalidação independente: `evidence/revalidation/round-02/VALIDATION.md` — `PASSED_WITH_WARNINGS` (Claude Opus 4.8 / Max; sessão `delivery-assurance/framework-v3-global-bootstrap-layout/round-02-stage-b`).
- Correção local comprovada diretamente: 10/10 `description` válidas (canônica/gerado/pacote), gate + testes negativos, regressões verdes (validate 12/12, test 138/138, distribution 58/58), pacote reproduzível, mapa 64 / cinco classes / nove retirements preservados; sem finding novo.

Histórico de status: `NEEDS_USER_DECISION` → `READY_FOR_CORRECTION` (autorização) → `VALIDATED` (revalidação independente).

Esta correction-spec **não autoriza execução adicional**. Foi estritamente **local** (fontes, tooling e testes em `framework/**` + regeneração/lock/pacote locais). Nenhuma operação global foi ou é contemplada aqui.

## Causa a corrigir

- **Fonte canônica incorreta:** `framework/skills/<slug>/SKILL.md` (10 arquivos) sem `description`.
- **Ponto cego do validador:** `tools/lib/skills.mjs::validateSkillText` não exige `description`; `parseSkillFrontmatter` também não.
- Gerador, pacote e instalador **não** são a causa (propagação fiel). Não corrigir o gerador quanto a conteúdo.

## Resultado esperado

As dez Skills conformes ao formato oficial Agent Skills (frontmatter com `name` **e** `description`), preservando toda a arquitetura v3, de modo que uma futura operação global (separada) possa tornar as Skills descobríveis e concluir a Etapa B.

## Escopo autorizado (local, se e quando aprovado)

1. **Restaurar `description` nas 10 `SKILL.md`** (`framework/skills/<slug>/SKILL.md`):
   - `description` não vazia, ≤ 1024 caracteres, descrevendo capacidade **e** gatilho de uso;
   - preservar `name` (= diretório), `version: 3.0.0`, `role`, `phase`, `references` e o corpo/seções (progressive disclosure intacto);
   - encoding UTF-8, sem BOM, line endings LF.
2. **Gate no validador + teste** (`tools/lib/skills.mjs` e `tests/skills/skills.test.mjs`):
   - `validateSkillText` passa a exigir `description` presente e não vazia;
   - teste que **falha** se qualquer uma das dez Skills tiver `description` ausente/vazia;
   - teste de catálogo/metadata compatível com o formato oficial (dois campos obrigatórios `name`+`description`; `name` = diretório; limite de tamanho da `description`).
3. **Regenerar outputs** pelos comandos oficiais (gerado = comentário de proveniência + canônica; a `description` é herdada automaticamente).
4. **Atualizar lock e pacote** na ordem oficial gerar → lock → pacote.
5. **Preservar** o mapa 64/64, as cinco classes, os nove retirements e a arquitetura (nenhum novo destino global, nenhuma nova classe, nenhuma dependência nova).
6. **Reexecutar** `npm run validate` e `npm test` (e a matriz de distribuição), mais casos negativos por `description`.
7. **Retornar** para revalidação independente (preservar a sessão round-02 desta segunda opinião).

## Efeitos colaterais previstos (registrar, não executar)

- Adicionar `description` altera bytes/hash das 10 `SKILL.md` → altera o hash do self-update (`workflow-bootstrap`) e, por encadeamento, gerados, `framework.lock`, `distribution-manifest.yaml` (via lock externo) e o pacote `.tgz`.
- Os quatro hashes vinculantes atuais (manifest `2be3970d…`, lock `e603adf0…`, package `434f1c09…`, self-update `38d95b69…`) **mudarão** após a correção. Isso é esperado e exige um **novo pacote** e uma **nova operação global** para propagar ao `~/.kiro`.

## Explicitamente NÃO autorizado nesta correction-spec

- alteração de `~/.kiro/**` ou de qualquer raiz global real;
- nova Etapa A; restart; Etapa B; reconciliação/finalização do receipt;
- piloto `PROJECT_UPDATE`; rollback (real ou sintético sobre o global);
- alteração de `package`, `lock`, `manifest`, `receipt`, `journal`, `backup`, contrato, `tasks.md` ou evidência anterior **fora** do fluxo local de correção aqui descrito;
- Git, staging, commit, push, PR, merge, tag, release, deploy;
- qualquer operação remota.

A **correção global** (tornar as Skills descobríveis no `~/.kiro`) é uma **operação separada e posterior**, iniciada somente após a correção local ser implementada e **revalidada independentemente**, com preflight, plano, snapshot, backup, rollback, modo Supervised e autorização próprios.

## Critérios de aceite da correção (para a revalidação futura)

- 10/10 `SKILL.md` com `description` válida (canônica, gerado, pacote);
- validador e testes falham sem `description` e passam com ela;
- `npm run validate` e `npm test` verdes; matriz de distribuição verde;
- mapa 64, cinco classes e nove retirements preservados;
- lock/pacote reconciliados e reproduzíveis;
- em runtime futuro (Etapa B de uma nova operação), as dez Skills descobertas no catálogo e o loader sem WARN de `missing name or description`.

## Decisão requerida do usuário

Aprovar (ou ajustar) o escopo local acima e autorizar a fase `correct-from-validation` na sessão `engineering-author/framework-v3`. Sem essa decisão, nenhuma correção é executada.
