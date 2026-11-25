# React Template

React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui + TanStack Query + Zod.

## Comandos

Execute na raiz do repositório. Use `yarn dev:web` para desenvolver, `yarn build` para gerar o React em `public/`, `yarn lint` para o lint e `yarn typecheck` para os tipos.

Rode `yarn lint` e `yarn typecheck` antes de considerar qualquer tarefa concluída.

## Estrutura

- `src/app/` composição: `index.tsx`, `layouts/`, `providers/`, `router/`, `not-found.tsx`
- `src/features/{feature}/` feature self-contained: `index.tsx`, `components/`, `hooks/`, `http/`, `schemas/`
- `src/shared/` compartilhado: `components/ui/`, `hooks/`, `lib/`, `schemas/`, `utils/`
- `src/assets/`, `src/styles/`, `src/env.ts`, `src/main.tsx`

`src/features/stickers/` é a referência de feature. Copie a estrutura dela
antes de inventar outra. Não promova código para `shared/` sem reuso real em 2+ features.

## Path aliases

Sempre aliases, nunca `../../../`.

| Alias | Caminho |
| ----- | ------- |
| `@/` | `src/` |
| `@components` | `src/shared/components` |
| `@lib` | `src/shared/lib` |
| `@hooks` | `src/shared/hooks` |
| `@utils` | `src/shared/utils` |
| `@schemas` | `src/shared/schemas` |
| `@assets` | `src/assets` |

## Invariantes

Estas quebram a aplicação ou o boot se forem violadas.

- **Root mounting.** `index.html` usa `<div id="app"></div>` e `src/main.tsx` usa
  `document.getElementById("app")`. O id é fixo. Divergência entre os dois arquivos é blocker.
- **Env.** Toda variável entra no schema Zod de `src/env.ts` antes de ser usada, e é
  acessada via `env` de `@/env`. Nunca `import.meta.env` direto. `App` bloqueia o boot
  com `ErrorLayout` quando a validação falha, não contorne isso.
- **HTTP.** Use o cliente de `@lib/api` para enviar a chave em todas as chamadas. Use `apiResponse` para streams e blobs. Uma função por endpoint
  em `src/features/{feature}/http/`, com parâmetros e retorno tipados e `schema.safeParse`
  na resposta.
- **TanStack Query.** Toda query ou mutation vive num hook `use*` em `hooks/` da feature.
  `queryKey` estável, `enabled: !!param` para input opcional, e renomeie o retorno com o
  prefixo do recurso (`users`, `isLoadingUsers`, `refetchUsers`).
- **Providers.** Adicione via `ComposeProviders([...])` em `src/app/providers/index.tsx`.
  `OuterProviders` para o que não depende do Router, `InnerProviders` para o que depende.

## Convenções

- Arquivos em kebab-case. Sufixos: `.schema.ts`, `.layout.tsx`, `use-*.ts`, `-skeleton.tsx`,
  `-error-alert.tsx`, `-query-status.tsx`. Página da feature é `index.tsx` exportando `{Feature}Page`.
- Componentes em PascalCase, named export. Props sempre em `interface`; `type` só para
  union, utility ou `z.infer`.
- Nunca confie em input opcional (props, query param, evento, payload de API). Guard clause
  ou early return antes de consumir. UI de estado inválido em `src/shared/components/states/`.
- Reuse `@components/ui` antes de criar componente novo. Tailwind v4 com `cn()` de `@utils/cn`,
  `cva` para variantes, e aceite `className?: string`. Use tokens do tema de
  `src/styles/globals.css`, não cores hardcoded.
- Ordem de imports: externos, depois `import type`, depois aliases, depois relativos,
  com linha em branco entre os grupos.

## Regras verificadas pelo lint

Estas duas são erro de ESLint, não sugestão. Não tente contorná-las com `eslint-disable`.

- `project/no-component-comments`: arquivos `.tsx` em `src/` não podem conter comentário de
  linha, bloco, JSDoc ou JSX. Se o componente precisa de um parágrafo explicando por que
  existe, o nome está errado ou ele faz coisa demais. JSDoc só em `src/shared/utils/`.
- `project/no-em-dash`: o caractere `—` é proibido em todo o código. Use hífen comum.
