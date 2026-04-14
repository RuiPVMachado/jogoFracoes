---
name: regressao-jogo
description: "Use after changes to game rules, deck logic, turn flow, AI behavior, or multiplayer room behavior to perform a standard functional regression check for the fraction game. Covers validating gameplay, UI impact, and multiplayer side effects."
argument-hint: "Descreve a alteração feita e o que queres validar"
---

# Validação Funcional do Jogo

## Quando usar

- Depois de alterar regras em `lib/game.ts`.
- Depois de mexer no fluxo principal em `components/game-board.tsx`.
- Depois de mexer em IA, lobby, sala ou validações de entrada/saída.
- Sempre que uma mudança possa quebrar o início do jogo, a progressão de turnos, a deteção de equivalências ou o arranque de uma sala.

## Objetivo

Executar uma validação funcional curta e repetível para confirmar que a alteração não introduziu regressões visíveis no jogo de frações.

## Procedimento

1. Identifica primeiro o tipo de mudança.

- Regras centrais: `lib/game.ts`
- Fluxo visual e interação: `components/game-board.tsx`
- Setup, dificuldade, criar/entrar em sala: `components/setup-screen.tsx`
- IA: `lib/ai.ts`
- Multiplayer: `app/api/room/route.ts` e `lib/room.ts`

2. Confirma o impacto esperado antes de validar.

- O que passou a acontecer.
- O que deixou de acontecer.
- Que ecrã, estado ou mensagem foi afetado.
- Se a mudança toca em PT-PT, mantém os textos coerentes com a UI existente.

3. Executa a validação funcional mínima do caminho afetado.

- Se a regra é de jogo, confirma início de partida, distribuição de cartas, deteção de equivalências, rejeição de jogadas inválidas e progresso de ronda.
- Se a regra é de IA, confirma que o bot joga no tempo certo, respeita a dificuldade e não bloqueia a partida.
- Se a regra é de multiplayer, confirma criar sala, entrar com código, limites de jogadores, mensagens de erro, polling do lobby e arranque automático quando a sala fica pronta.

4. Faz uma verificação de regressão nos fluxos relacionados.

- Volta ao menu e reinicia jogo sem deixar estado preso.
- Verifica que o fluxo alternativo continua a funcionar.
- Confirma que mudanças no servidor e no cliente continuam alinhadas.

5. Decide se a alteração está pronta.

- Aprova se o comportamento novo está correto e não introduziu efeitos colaterais visíveis.
- Reabre a análise se houver inconsistência entre UI, estado e API.
- Se faltarem certezas, descreve o risco em vez de assumir que está resolvido.

## Checklist obrigatória

- [ ] O comportamento novo é observável no caminho principal do jogo.
- [ ] Nenhum fluxo existente ficou bloqueado.
- [ ] Mensagens de erro e feedback continuam claros e em PT-PT.
- [ ] Multiplayer continua consistente entre API, wrapper cliente e lobby.
- [ ] O jogo pode ser reiniciado sem estado residual.
- [ ] A validação não se limitou ao build; foi confirmada a experiência funcional.

## Critérios de conclusão

A validação só termina quando fica claro que:

- a alteração foi aplicada no sítio certo;
- o fluxo principal continua jogável;
- os fluxos adjacentes relevantes não quebraram;
- qualquer risco remanescente foi explicitado.
