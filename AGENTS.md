# Agent Instructions

**Tipo:** Instruções permanentes locais do repositório canônico
**Arquitetura:** Global-first

## Identificação do projeto

- Nome: AgenticDevOps
- Descrição: Repositório canônico privado do framework de workflow AgenticDevOps v3.
- Objetivo: Manter, validar e distribuir internamente o framework com comportamento determinístico e governança auditável.
- Domínio: Governança de desenvolvimento assistido por agentes e automação de workflow.
- Visibilidade: Privada; uso interno autorizado.
- Repositório canônico: `TicoVillas/AgenticDevOps`.
- Política de uso: `PRIVATE-USE-LICENSE.md`; todos os direitos reservados.

## Contexto permanente

- A raiz deste repositório é a raiz canônica da implementação; não existe diretório intermediário `framework/`.
- Governança versionada: `AGENTS.md`, `.agentic/**` e `.kiro/specs/**`.
- Governança não integra packages nem assets de runtime; a allowlist de `package.json#files` é autoritativa.
- Runtime de referência de validadores e geradores: Node.js 24.x.
- Linguagem das ferramentas: JavaScript ESM, sem TypeScript ou transpilação.
- Package manager: npm; manifests na raiz em `package.json` e `package-lock.json`.
- Dependências locais mínimas autorizadas: `ajv`, `ajv-formats` e `yaml`, sempre pinadas exatamente e registradas no lockfile.
- Comandos oficiais, executados a partir da raiz:
  - `npm run validate`
  - `npm test`
- Testes usam `node:test`; hashes usam `node:crypto`; filesystem e contenção de paths usam `node:fs` e `node:path`.
- Instalação autorizada somente local, com `npm ci --ignore-scripts`; nenhuma instalação global.
- Preflight sem Node major 24 ou npm deve produzir `NEEDS_STATE_VALIDATION`, sem instalar ou atualizar Node automaticamente.
- Node é runtime das ferramentas; core, schemas, contratos e Skills permanecem tool-neutral.

## Convenções e limites locais

- Preservar uma única fonte normativa por regra; gerados, manifests e locks permanecem derivados.
- A estrutura global-first permanece em `~/.kiro/`; não criar cópias locais de workflow-core, contratos ou Skills globais fora dos caminhos definidos pelo framework.
- Skills, políticas, contratos e artefatos devem ser referenciados, não reproduzidos neste arquivo.
- Mudanças de Git, GitHub, signing, release, instalação global e limpeza exigem autorizações próprias.

## Segurança e operação

- Não versionar segredos, credenciais, tokens, chaves privadas ou state operacional real.
- Receipts, journals, backups, tombstones, locks, caches e temporários operacionais devem permanecer fora do repositório.
- Metadados e evidências devem ser sanitizados e nunca incluir conteúdo sensível.
