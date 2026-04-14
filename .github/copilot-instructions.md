# Project Guidelines

## Contexto do Projeto

- Aplicação Next.js (App Router) para o jogo de frações equivalente.
- UI em PT-PT (rótulos, mensagens, botões e textos de erro).
- Dois modos principais: contra computador e multijogador por sala.

## Arquitetura

- `app/page.tsx`: orquestra setup, início de jogo e reinício.
- `components/setup-screen.tsx`: fluxo de configuração (modo, dificuldade, criar/entrar em sala, lobby).
- `components/game-board.tsx`: tabuleiro e fluxo principal da partida.
- `lib/game.ts`: tipos e regras centrais (baralho, equivalência, inicialização).
- `lib/ai.ts`: comportamento do bot por dificuldade.
- `app/api/room/route.ts`: API de salas em memória (estado efémero).

## Build e Execução

- `npm run dev`: servidor local.
- `npm run build`: build de produção.
- `npm start`: servidor de produção.
- `npm run lint`: configurado no `package.json`, mas falta ficheiro de configuração do ESLint.

## Convenções de Código

- Usar TypeScript com tipos explícitos para estado, props e entidades de jogo.
- Preservar textos de UI em português.
- Em componentes React interativos, manter padrão com `"use client"`.
- Estilos com Tailwind + variáveis CSS em `app/globals.css`; usar `style={{ ... }}` apenas para valores dinâmicos (ex.: cor do jogador).
- Seguir estrutura e comentários de secção já existente em `lib/game.ts` para lógica de domínio.

## Pontos de Atenção

- `next.config.mjs` usa `typescript.ignoreBuildErrors: true`; não assumir que build sem erros implica tipagem correta.
- O estado das salas em `app/api/room/route.ts` usa `Map` em memória de processo; reinício do servidor perde salas e não escala horizontalmente.
- O cleanup de salas acontece por request, não por scheduler dedicado.

## Mudanças Recomendadas para Agentes

- Para mudanças de regra, priorizar `lib/game.ts` e validar impacto em `components/game-board.tsx`.
- Para mudanças de multiplayer, alinhar `components/setup-screen.tsx`, `lib/room.ts` e `app/api/room/route.ts`.
- Evitar refactors amplos em `components/ui/` sem necessidade (biblioteca base compartilhada).
