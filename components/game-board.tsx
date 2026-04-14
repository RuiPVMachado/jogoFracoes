"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FractionCard } from "@/components/fraction-card";
import {
  type GameState,
  type Player,
  type GameCard,
  type FractionSlot,
  findMatches,
  slotLabel,
} from "@/lib/game";
import { type AIDifficulty, getAIAction } from "@/lib/ai";
import { cn } from "@/lib/utils";

interface GameBoardProps {
  gameState: GameState;
  aiDifficulty?: AIDifficulty;
  onGameStateChange: (state: GameState) => void;
  localPlayerName?: string;
  onRestart: () => void;
}

// ── Confirmation modal: player picks WHICH slot they think matches ─────────
// Step 1: choose a slot from their own card
// Step 2: choose which slot on the center card it matches
// The system only validates at the end — the player must deduce it themselves.

interface MatchConfirmProps {
  playerCard: GameCard;
  centerCard: GameCard;
  playerColor: string;
  /** called with the chosen indices; if wrong, caller handles penalty */
  onAnswer: (cardSlotIdx: number, centerSlotIdx: number) => void;
  onCancel: () => void;
}

function MatchConfirmModal({
  playerCard,
  centerCard,
  playerColor,
  onAnswer,
  onCancel,
}: MatchConfirmProps) {
  const [selectedCardSlot, setSelectedCardSlot] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border-4 flex flex-col gap-4"
        style={{ borderColor: playerColor }}
      >
        <div>
          <h2
            className="text-lg font-black"
            style={{ color: "var(--foreground)" }}
          >
            Qual a equivalência?
          </h2>
          <p
            className="text-sm font-semibold mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            {selectedCardSlot === null
              ? "Escolhe a fração da tua carta:"
              : `Escolhe a fração equivalente na carta do centro:`}
          </p>
        </div>

        {/* Step 1 — pick a slot from player's card */}
        {selectedCardSlot === null && (
          <div className="flex flex-col gap-2">
            <p
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: "var(--muted-foreground)" }}
            >
              A tua carta
            </p>
            {playerCard.slots.map((slot, i) => (
              <button
                key={i}
                onClick={() => setSelectedCardSlot(i)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-black text-base transition-all hover:scale-[1.02] active:scale-95 text-left"
                style={{
                  borderColor: playerColor,
                  background: `${playerColor}12`,
                  color: "var(--foreground)",
                }}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                  style={{ background: playerColor }}
                >
                  {i + 1}
                </span>
                <span style={{ color: playerColor }}>{slotLabel(slot)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — pick a slot from the center card */}
        {selectedCardSlot !== null && (
          <div className="flex flex-col gap-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl border-2"
              style={{
                borderColor: playerColor,
                background: `${playerColor}12`,
              }}
            >
              <span
                className="text-xs font-bold"
                style={{ color: "var(--muted-foreground)" }}
              >
                Escolheste:
              </span>
              <span
                className="font-black text-base"
                style={{ color: playerColor }}
              >
                {slotLabel(playerCard.slots[selectedCardSlot])}
              </span>
            </div>
            <p
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: "var(--muted-foreground)" }}
            >
              Carta do centro — seleciona a equivalente
            </p>
            {centerCard.slots.map((slot, i) => (
              <button
                key={i}
                onClick={() => onAnswer(selectedCardSlot, i)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-black text-base transition-all hover:scale-[1.02] active:scale-95 text-left"
                style={{
                  borderColor: "#22c55e",
                  background: "#22c55e12",
                  color: "var(--foreground)",
                }}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                  style={{ background: "#22c55e" }}
                >
                  {i + 1}
                </span>
                <span style={{ color: "#16a34a" }}>{slotLabel(slot)}</span>
              </button>
            ))}
            <button
              onClick={() => setSelectedCardSlot(null)}
              className="text-xs font-bold underline text-left mt-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              Voltar atras
            </button>
          </div>
        )}

        <button
          onClick={onCancel}
          className="mt-1 py-2.5 rounded-xl border-2 font-black text-sm transition-colors hover:bg-muted"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── PlayerZone ────────────────────────────────────────────────────────────

function PlayerZone({
  player,
  isHighlighted,
  highlightedSlots,
  onFlip,
  canFlip,
  onClaim,
  canClaim,
}: {
  player: Player;
  isHighlighted: boolean;
  highlightedSlots: number[];
  onFlip: () => void;
  canFlip: boolean;
  onClaim: () => void;
  canClaim: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 p-4 rounded-3xl border-4 transition-all duration-300",
        isHighlighted ? "shadow-xl scale-105" : "shadow-sm",
      )}
      style={{
        borderColor: isHighlighted ? player.color : "var(--border)",
        background: isHighlighted ? `${player.color}12` : "var(--card)",
      }}
    >
      {/* Name badge */}
      <div
        className="px-4 py-1.5 rounded-full text-white text-sm font-black flex items-center gap-2"
        style={{ background: player.color }}
      >
        {player.isAI && (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 7H7v6h6V7z" />
            <path
              fillRule="evenodd"
              d="M10 2a8 8 0 100 16A8 8 0 0010 2zM2 10a8 8 0 1116 0A8 8 0 012 10z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {player.name}
      </div>

      {/* Cards row */}
      <div className="flex items-end gap-3">
        {/* Current played card (face-up) */}
        {player.currentCard ? (
          <FractionCard
            card={player.currentCard}
            accentColor={player.color}
            variant="play"
            highlightedSlots={isHighlighted ? highlightedSlots : []}
          />
        ) : (
          <div
            className="w-40 h-64 rounded-2xl border-4 border-dashed flex items-center justify-center"
            style={{ borderColor: `${player.color}50` }}
          >
            <span
              className="text-4xl font-black"
              style={{ color: `${player.color}50` }}
            >
              ?
            </span>
          </div>
        )}

        {/* Hand stack */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative w-20 h-28">
            {player.hand.length > 0 ? (
              player.hand
                .slice(0, Math.min(3, player.hand.length))
                .map((_, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-2xl border-2 border-white/40"
                    style={{
                      transform: `rotate(${(i - 1) * 3}deg) translateY(${-i * 2}px)`,
                      background:
                        "repeating-linear-gradient(45deg,#6366f1,#6366f1 5px,#818cf8 5px,#818cf8 14px)",
                      zIndex: 3 - i,
                    }}
                  />
                ))
            ) : (
              <div
                className="absolute inset-0 rounded-2xl border-4 border-dashed flex items-center justify-center"
                style={{ borderColor: "var(--border)" }}
              >
                <span
                  className="text-2xl font-black"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  0
                </span>
              </div>
            )}
          </div>
          <span
            className="text-xs font-bold"
            style={{ color: "var(--muted-foreground)" }}
          >
            {player.hand.length} carta{player.hand.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {canFlip && (
          <button
            onClick={onFlip}
            className="px-5 py-2 rounded-full text-white font-black text-sm shadow-lg active:scale-95 transition-transform"
            style={{ background: player.color }}
          >
            Virar Carta
          </button>
        )}
        {canClaim && (
          <button
            onClick={onClaim}
            className="px-5 py-2 rounded-full text-white font-black text-sm shadow-lg active:scale-95 transition-transform animate-bounce"
            style={{ background: "#f59e0b" }}
          >
            Tenho equivalencia!
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main GameBoard ─────────────────────────────────────────────────────────

export function GameBoard({
  gameState,
  aiDifficulty = "medio",
  onGameStateChange,
  localPlayerName,
  onRestart,
}: GameBoardProps) {
  const [confirmingPlayerId, setConfirmingPlayerId] = useState<number | null>(
    null,
  );
  // Track highlighted card slots per player (for showing which slots matched)
  const [highlightedSlots, setHighlightedSlots] = useState<
    Record<number, number[]>
  >({});
  const aiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // All players that still have cards or a current card
  const activePlayers = gameState.players.filter(
    (p) => p.hand.length > 0 || p.currentCard !== null,
  );

  const allFlipped = activePlayers.every((p) => p.currentCard !== null);

  // ── Flip a card ──
  const handleFlip = useCallback(
    (playerId: number) => {
      const player = gameState.players[playerId];
      if (!player || player.hand.length === 0 || player.currentCard) return;
      if (
        gameState.mode === "multiplayer" &&
        localPlayerName &&
        player.name !== localPlayerName
      )
        return;

      const [newCard, ...newHand] = player.hand;
      const updatedPlayers = gameState.players.map((p) =>
        p.id === playerId ? { ...p, currentCard: newCard, hand: newHand } : p,
      );

      onGameStateChange({
        ...gameState,
        players: updatedPlayers,
        message: `${player.name} virou a carta!`,
      });
    },
    [gameState, onGameStateChange, localPlayerName],
  );

  // ── AI auto-flip & auto-claim ──
  useEffect(() => {
    if (gameState.phase !== "playing") return;

    const aiPlayer = gameState.players.find((p) => p.isAI);
    if (!aiPlayer || aiPlayer.currentCard || aiPlayer.hand.length === 0) return;

    // Clear any pending timer
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    const { delay } = getAIAction(aiDifficulty);
    aiTimerRef.current = setTimeout(() => {
      // Flip AI card
      const [newCard, ...newHand] = aiPlayer.hand;
      const stateAfterFlip: GameState = {
        ...gameState,
        players: gameState.players.map((p) =>
          p.isAI ? { ...p, currentCard: newCard, hand: newHand } : p,
        ),
        message: `${aiPlayer.name} virou a carta!`,
      };
      onGameStateChange(stateAfterFlip);

      // AI claims after a short additional delay if it has a match
      if (gameState.centerCard) {
        const matches = findMatches(newCard, gameState.centerCard);
        const { delay: claimDelay, willMatch } = getAIAction(aiDifficulty);
        if (willMatch && matches.length > 0) {
          aiTimerRef.current = setTimeout(
            () => {
              applyClaimInternal(
                stateAfterFlip,
                aiPlayer.id,
                matches[0].cardSlotIdx,
                matches[0].centerSlotIdx,
              );
            },
            Math.round(claimDelay * 0.4),
          );
        }
      }
    }, delay);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players.find((p) => p.isAI)?.currentCard, gameState.phase]);

  // ── Apply an answer from the player ──
  // Validates the chosen pair. If correct → win the round (card removed, new center).
  // If wrong → lose the turn but keep the card (it goes back to currentCard so they
  // must wait for the next round flip — we put it back into hand bottom so the round resets).
  const applyClaimInternal = useCallback(
    (
      state: GameState,
      playerId: number,
      cardSlotIdx: number,
      centerSlotIdx: number,
    ) => {
      const player = state.players[playerId];
      if (!player?.currentCard || !state.centerCard) return;

      const chosenCardSlot = player.currentCard.slots[cardSlotIdx];
      const chosenCenterSlot = state.centerCard.slots[centerSlotIdx];
      const isCorrect =
        Math.abs(
          chosenCardSlot.numerator / chosenCardSlot.denominator -
            chosenCenterSlot.numerator / chosenCenterSlot.denominator,
        ) < 0.00001;

      if (isCorrect) {
        // Correct — winning card becomes the new center
        // All other current cards return to the bottom of their owner's hand
        const newCenter = player.currentCard;
        const matchLabel = `${slotLabel(chosenCardSlot)} = ${slotLabel(chosenCenterSlot)}`;

        const updatedPlayers = state.players.map((p) => {
          if (p.id === playerId) return { ...p, currentCard: null };
          if (p.currentCard)
            return {
              ...p,
              hand: [...p.hand, p.currentCard],
              currentCard: null,
            };
          return p;
        });

        const winner = updatedPlayers.find(
          (p) => p.hand.length === 0 && p.currentCard === null,
        );

        setHighlightedSlots({ [playerId]: [cardSlotIdx] });

        onGameStateChange({
          ...state,
          players: updatedPlayers,
          centerCard: newCenter,
          centerMatchSlot: chosenCenterSlot,
          phase: winner ? "won" : "playing",
          winner: winner ?? null,
          round: state.round + 1,
          message: `Correto! ${matchLabel}. Nova ronda!`,
          highlightedPlayerId: playerId,
        });

        setTimeout(() => setHighlightedSlots({}), 1500);
      } else {
        // Wrong answer — reset the round so everyone can flip again.
        const updatedPlayers = state.players.map((p) => {
          if (p.currentCard) {
            return {
              ...p,
              hand: [...p.hand, p.currentCard],
              currentCard: null,
            };
          }
          return p;
        });

        onGameStateChange({
          ...state,
          players: updatedPlayers,
          message: `${player.name} errou! Ronda reiniciada, virem cartas novamente.`,
          highlightedPlayerId: null,
        });
      }
    },
    [onGameStateChange],
  );

  const handleClaimOpen = (playerId: number) => {
    const player = gameState.players[playerId];
    if (!player) return;
    if (
      gameState.mode === "multiplayer" &&
      localPlayerName &&
      player.name !== localPlayerName
    )
      return;
    setConfirmingPlayerId(playerId);
  };

  const handleAnswer = (cardSlotIdx: number, centerSlotIdx: number) => {
    if (confirmingPlayerId === null) return;
    setConfirmingPlayerId(null);
    applyClaimInternal(
      gameState,
      confirmingPlayerId,
      cardSlotIdx,
      centerSlotIdx,
    );
  };

  const confirmingPlayer =
    confirmingPlayerId !== null
      ? gameState.players.find((p) => p.id === confirmingPlayerId)
      : null;

  const gridCols =
    gameState.players.length === 4
      ? "grid-cols-2"
      : gameState.players.length === 2
        ? "grid-cols-2"
        : "grid-cols-1";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--background)" }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b-2"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-lg"
            style={{ background: "var(--primary)" }}
          >
            ½
          </div>
          <div>
            <h1
              className="font-black text-base leading-none"
              style={{ color: "var(--foreground)" }}
            >
              Fracoes!
            </h1>
            <p
              className="text-xs font-semibold leading-none mt-0.5"
              style={{ color: "var(--muted-foreground)" }}
            >
              Ronda {gameState.round}
              {gameState.roomCode && ` · Sala ${gameState.roomCode}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Message bubble (desktop) */}
          <div
            className="hidden md:block max-w-xs px-4 py-2 rounded-2xl border-2"
            style={{ background: "var(--muted)", borderColor: "var(--border)" }}
          >
            <p
              className="text-sm font-bold text-center"
              style={{ color: "var(--foreground)" }}
            >
              {gameState.message}
            </p>
          </div>
          <button
            onClick={onRestart}
            className="px-4 py-2 rounded-full border-2 text-sm font-bold transition-colors hover:bg-muted"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Reiniciar
          </button>
        </div>
      </header>

      {/* Message (mobile) */}
      <div
        className="md:hidden mx-4 mt-3 px-4 py-2 rounded-2xl border-2"
        style={{ background: "var(--muted)", borderColor: "var(--border)" }}
      >
        <p
          className="text-sm font-bold text-center"
          style={{ color: "var(--foreground)" }}
        >
          {gameState.message}
        </p>
      </div>

      {/* ── Match confirmation modal ── */}
      {confirmingPlayerId !== null &&
        confirmingPlayer?.currentCard &&
        gameState.centerCard && (
          <MatchConfirmModal
            playerCard={confirmingPlayer.currentCard}
            centerCard={gameState.centerCard}
            playerColor={confirmingPlayer.color}
            onAnswer={handleAnswer}
            onCancel={() => setConfirmingPlayerId(null)}
          />
        )}

      {/* ── Won overlay ── */}
      {gameState.phase === "won" && gameState.winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4"
            style={{ borderColor: gameState.winner.color }}
          >
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl font-black"
              style={{ background: gameState.winner.color }}
            >
              1
            </div>
            <h2
              className="text-3xl font-black mb-2 text-balance"
              style={{ color: gameState.winner.color }}
            >
              {gameState.winner.name} venceu!
            </h2>
            <p
              className="font-semibold mb-6"
              style={{ color: "var(--muted-foreground)" }}
            >
              Ficou sem cartas primeiro. Parabens!
            </p>
            <button
              onClick={onRestart}
              className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-lg hover:opacity-90 active:scale-95 transition-all"
              style={{ background: gameState.winner.color }}
            >
              Novo Jogo
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      <main className="flex-1 flex flex-col lg:flex-row items-start gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {/* Player zones */}
        <div className={cn("flex-1 grid gap-4 w-full", gridCols)}>
          {gameState.players.map((player) => {
            const isLocalPlayer =
              gameState.mode === "multiplayer"
                ? player.name === localPlayerName
                : !player.isAI;

            return (
              <PlayerZone
                key={player.id}
                player={player}
                isHighlighted={gameState.highlightedPlayerId === player.id}
                highlightedSlots={highlightedSlots[player.id] ?? []}
                onFlip={() => handleFlip(player.id)}
                canFlip={
                  isLocalPlayer && !player.currentCard && player.hand.length > 0
                }
                onClaim={() => handleClaimOpen(player.id)}
                canClaim={
                  isLocalPlayer &&
                  !!player.currentCard &&
                  allFlipped &&
                  gameState.phase === "playing"
                }
              />
            );
          })}
        </div>

        {/* Center column */}
        <div className="flex flex-col items-center gap-3 lg:w-56 w-full">
          <p
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)" }}
          >
            Carta do Centro
          </p>

          {gameState.centerCard && (
            <FractionCard
              card={gameState.centerCard}
              accentColor="#22c55e"
              variant="center"
            />
          )}

          {/* Score board */}
          <div
            className="w-full rounded-2xl p-3 border-2"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <p
              className="text-xs font-black uppercase tracking-widest mb-2 text-center"
              style={{ color: "var(--muted-foreground)" }}
            >
              Cartas em mao
            </p>
            {gameState.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-1"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: p.color }}
                  />
                  <span
                    className="text-sm font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {p.name}
                  </span>
                </div>
                <span className="text-sm font-black" style={{ color: p.color }}>
                  {p.hand.length + (p.currentCard ? 1 : 0)}
                </span>
              </div>
            ))}
          </div>

          {/* Progress indicator */}
          {gameState.phase === "playing" && !allFlipped && (
            <div
              className="w-full rounded-2xl p-3 border-2 text-center"
              style={{
                background: "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
              <p
                className="text-xs font-bold"
                style={{ color: "var(--muted-foreground)" }}
              >
                {activePlayers.filter((p) => p.currentCard).length}/
                {activePlayers.length} viraram a carta
              </p>
              <div
                className="mt-2 h-2 rounded-full overflow-hidden"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    background: "var(--primary)",
                    width: `${(activePlayers.filter((p) => p.currentCard).length / activePlayers.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {allFlipped && gameState.phase === "playing" && (
            <div
              className="w-full rounded-2xl p-3 border-2 text-center"
              style={{ background: "#fef9c3", borderColor: "#fde047" }}
            >
              <p className="text-sm font-black" style={{ color: "#713f12" }}>
                Todos viraram! Quem tem equivalencia?
              </p>
              <p
                className="text-xs font-semibold mt-1"
                style={{ color: "#92400e" }}
              >
                Clica em "Tenho equivalencia!"
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
