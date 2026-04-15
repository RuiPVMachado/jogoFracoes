# Jogo das Frações

Aplicação web em Next.js para praticar equivalências de frações em formato de jogo rápido (estilo cartas). O projeto está em português de Portugal (PT-PT) e inclui modo contra computador e modo multijogador por salas.

## Objetivo

Encontrar, o mais rapidamente possível, uma fração equivalente entre a carta de cada jogador e a carta do centro.

## Funcionalidades

- Modo Jogador vs Computador com 3 dificuldades:
  - Fácil
  - Médio
  - Difícil
- Modo Multijogador online por sala:
  - Criar sala (2 ou 4 jogadores)
  - Entrar por código de 6 caracteres
  - Lobby com atualização periódica do estado
  - Início manual da partida pelo anfitrião quando a sala está completa
- Tabuleiro com validação de equivalências fração a fração
- Feedback visual de rondas, cartas restantes e vencedor
- Reinício de jogo e encerramento de sala no modo multijogador

## Stack Tecnológica

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- Componentes UI baseados em Radix UI

## Estrutura Principal

- `app/page.tsx`: orquestra setup, arranque e reinício da partida
- `components/setup-screen.tsx`: fluxo de configuração (modo, criar/entrar em sala, lobby)
- `components/game-board.tsx`: fluxo principal da partida e ações dos jogadores
- `lib/game.ts`: tipos e regras centrais (baralho, equivalências, inicialização)
- `lib/ai.ts`: lógica da IA por dificuldade
- `lib/room.ts`: cliente para comunicação com API de salas
- `app/api/room/route.ts`: API de salas em memória (estado efémero)

## Regras de Jogo (Resumo)

1. Todos os jogadores viram uma carta.
2. Cada carta tem 6 frações.
3. Quando todos tiverem carta virada, cada jogador pode declarar equivalência.
4. Se a equivalência estiver correta, a carta do jogador passa para o centro e inicia nova ronda.
5. Se estiver errada, a ronda é reiniciada e as cartas viradas regressam às mãos.
6. Vence quem ficar sem cartas primeiro.

## Como Executar Localmente

### Pré-requisitos

- Node.js 18+ (recomendado: versão LTS recente)
- npm

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

Abrir no browser: `http://localhost:3000`

### Build de produção

```bash
npm run build
npm start
```

## Scripts Disponíveis

- `npm run dev`: arranca em modo desenvolvimento
- `npm run build`: gera build de produção
- `npm start`: serve a build de produção
- `npm run lint`: executa ESLint

## API de Salas (Resumo)

Endpoint base: `/api/room`

- `GET /api/room?code=XXXXXX`: obter estado da sala
- `POST /api/room`: criar sala
- `PATCH /api/room` com `action`:
  - `join`: entrar na sala
  - `start`: iniciar partida (anfitrião)
  - `sync-state`: sincronizar estado da partida
  - `close`: encerrar sala

## Limitações Conhecidas

- As salas multijogador são guardadas em `Map` na memória do processo (`app/api/room/route.ts`):
  - perdem-se ao reiniciar o servidor
  - não escalam horizontalmente sem backend partilhado (ex.: Redis/Supabase)
- A limpeza de salas é acionada por pedido (request), não por scheduler dedicado.
- `next.config.mjs` está com `typescript.ignoreBuildErrors: true`, por isso uma build concluída não garante ausência de erros de tipagem.
- O script `npm run lint` existe, mas pode requerer configuração adicional do ESLint no repositório.

## Notas de Produto

- Interface e mensagens orientadas a público escolar em PT-PT.
- No multijogador, o estado da partida é sincronizado por versão para reduzir conflitos entre clientes.

---

Se quiseres, posso também acrescentar ao README uma secção de "Contribuição" (workflow de PR, convenções de commit e checklist de testes).
