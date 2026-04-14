---
description: "Use when changing core fraction game rules, deck logic, turn flow, scoring, AI behavior, or any gameplay rule that can affect multiple files. Includes a mandatory impact checklist before editing."
name: "Alterar Regras de Frações"
argument-hint: "Descreve a regra a alterar e o efeito esperado no jogo"
agent: "agent"
---

# Alterar Regras do Jogo

Analisa a alteração pedida nas regras do jogo de frações e aplica-a com o menor conjunto de mudanças possível.

Antes de editar qualquer ficheiro, faz e segue este checklist de impacto obrigatório:

- [ ] `lib/game.ts` para tipos, baralho, equivalência, inicialização, turnos e estado do jogo.
- [ ] `components/game-board.tsx` para fluxo visual, interações e mensagens de jogo.
- [ ] `components/setup-screen.tsx` se a regra afetar o arranque, modo de jogo, dificuldade ou sala.
- [ ] `lib/ai.ts` se a alteração mudar o comportamento do computador.
- [ ] `lib/room.ts` e [multiplayer.instructions.md](../instructions/multiplayer.instructions.md) se a regra tocar em salas, lobby ou sincronização.
- [ ] Textos de UI em PT-PT, mantendo consistência com o resto da aplicação.
- [ ] Possíveis regressões em validações, estados intermédios e mensagens de erro.

Se algum ponto do checklist estiver ambíguo, pergunta antes de editar.

Depois de confirmar o impacto:

- atualiza primeiro a lógica de domínio;
- adapta a UI só no necessário;
- preserva os nomes e padrões existentes;
- evita refactors sem relação direta com a regra pedida.

No fim, devolve um resumo curto com:

- o que mudou;
- os ficheiros tocados;
- os impactos validados;
- qualquer risco ou suposição que ainda fique em aberto.
