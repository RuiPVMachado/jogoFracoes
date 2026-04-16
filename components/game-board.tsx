"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { FractionCard, FractionSymbolGrid, SlotCell } from "@/components/fraction-card";
import {
  type GameState,
  type Player,
  type GameCard,
  type FractionSlot,
  findMatches,
  slotsEquivalent,
  slotLabel,
} from "@/lib/game";
import { cn } from "@/lib/utils";


interface GameBoardProps {
  gameState: GameState;
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
  const [selectedCenterSlot, setSelectedCenterSlot] = useState<number | null>(
    null,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-3xl p-5 sm:p-6 max-w-3xl w-full shadow-2xl border-4 flex flex-col gap-4"
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
            Seleciona 1 simbolo da tua carta e 1 simbolo da carta do centro.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            className="rounded-2xl border p-3"
            style={{
              borderColor: `${playerColor}66`,
              background: `${playerColor}0d`,
            }}
          >
            <p
              className="text-xs font-black uppercase tracking-widest text-center mb-2"
              style={{ color: playerColor }}
            >
              A tua carta
            </p>
            <div className="flex justify-center">
              <FractionSymbolGrid
                card={playerCard}
                accentColor={playerColor}
                selectedSlot={selectedCardSlot}
                onSlotSelect={setSelectedCardSlot}
              />
            </div>
          </div>

          <div
            className="rounded-2xl border p-3"
            style={{ borderColor: "#22c55e66", background: "#22c55e0d" }}
          >
            <p
              className="text-xs font-black uppercase tracking-widest text-center mb-2"
              style={{ color: "#16a34a" }}
            >
              Carta do centro
            </p>
            <div className="flex justify-center">
              <FractionSymbolGrid
                card={centerCard}
                accentColor="#22c55e"
                selectedSlot={selectedCenterSlot}
                onSlotSelect={setSelectedCenterSlot}
              />
            </div>
          </div>
        </div>

        <p
          className="text-xs font-bold text-center"
          style={{ color: "var(--muted-foreground)" }}
        >
          So podes selecionar 1 de cada carta.
        </p>

        <button
          onClick={() => {
            if (selectedCardSlot === null || selectedCenterSlot === null)
              return;
            onAnswer(selectedCardSlot, selectedCenterSlot);
          }}
          disabled={selectedCardSlot === null || selectedCenterSlot === null}
          className="py-2.5 rounded-xl text-white font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: playerColor }}
        >
          Confirmar equivalencia
        </button>

        <button
          onClick={onCancel}
          className="py-2.5 rounded-xl border-2 font-black text-sm transition-colors hover:bg-muted"
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
  isBouncing,
}: {
  player: Player;
  isHighlighted: boolean;
  highlightedSlots: number[];
  onFlip: () => void;
  canFlip: boolean;
  onClaim: () => void;
  canClaim: boolean;
  isBouncing: boolean;
}) {

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 p-3 sm:p-4 rounded-3xl border-4 transition-all duration-300",
        isHighlighted ? "shadow-xl md:scale-105" : "shadow-sm",
      )}
      style={{
        borderColor: isHighlighted ? player.color : "var(--border)",
        background: isHighlighted ? `${player.color}12` : "var(--card)",
      }}
    >
      {/* Name badge */}
      <div
        className="px-4 py-1.5 rounded-full text-white text-xs sm:text-sm font-black flex items-center gap-2"
        style={{ background: player.color }}
      >
        {player.name}
      </div>

      {/* Cards row */}
      <div className="flex items-end justify-center gap-2 sm:gap-3 w-full">
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
            className="w-[min(44vw,10rem)] h-[min(70vw,16rem)] sm:w-40 sm:h-64 rounded-2xl border-4 border-dashed flex items-center justify-center"
            style={{ borderColor: `${player.color}50` }}
          >
            <span
              className="text-3xl sm:text-4xl font-black"
              style={{ color: `${player.color}50` }}
            >
              ?
            </span>
          </div>
        )}

        {/* Hand stack */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative w-16 h-24 sm:w-20 sm:h-28">
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
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        {canFlip && (
          <button
            onClick={onFlip}
            className="w-full sm:w-auto px-4 sm:px-5 py-2 rounded-full text-white font-black text-xs sm:text-sm shadow-lg active:scale-95 transition-transform"
            style={{ background: player.color }}
          >
            Virar Carta
          </button>
        )}
        {canClaim && (
          <button
            onClick={onClaim}
            className={cn(
              "w-full sm:w-auto px-4 sm:px-5 py-2 rounded-full text-white font-black text-xs sm:text-sm shadow-lg active:scale-95 transition-transform",
              isBouncing && "animate-bounce",
            )}
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
  onGameStateChange,
  localPlayerName,
  onRestart,
}: GameBoardProps) {
  const [confirmingPlayerId, setConfirmingPlayerId] = useState<number | null>(
    null,
  );
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // Track highlighted card slots per player (for showing which slots matched)
  const [highlightedSlots, setHighlightedSlots] = useState<
    Record<number, number[]>
  >({});
  // Short-lived bounce on the "Tenho equivalência!" button (cleared after 2s)
  const [bouncingClaimIds, setBouncingClaimIds] = useState<Set<number>>(
    new Set(),
  );
  const bounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [roundWinnerPopup, setRoundWinnerPopup] = useState<{
    name: string;
    color: string;
    matchedSlots?: { playerSlot: FractionSlot; centerSlot: FractionSlot };
  } | null>(null);
  const [roundCountdown, setRoundCountdown] = useState<number | null>(null);

  const [roundErrorPopup, setRoundErrorPopup] = useState<{
    name: string;
  } | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousMessageRef = useRef(gameState.message);
  const roundWinnerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundCountdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousRoundRef = useRef(gameState.round);

  const clearRoundTransitionTimers = useCallback(() => {
    if (roundWinnerTimerRef.current) {
      clearTimeout(roundWinnerTimerRef.current);
      roundWinnerTimerRef.current = null;
    }

    if (roundCountdownTimerRef.current) {
      clearInterval(roundCountdownTimerRef.current);
      roundCountdownTimerRef.current = null;
    }
    
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setRoundErrorPopup(null);
  }, []);

  // All players that still have cards or a current card
  const activePlayers = gameState.players.filter(
    (p) => p.hand.length > 0 || p.currentCard !== null,
  );

  const allFlipped = activePlayers.every((p) => p.currentCard !== null);
  const isRoundTransitioning =
    roundWinnerPopup !== null || roundCountdown !== null || roundErrorPopup !== null;

  // Trigger a short bounce animation on claim buttons when allFlipped becomes true
  useEffect(() => {
    if (allFlipped && gameState.phase === "playing") {
      const ids = new Set(activePlayers.map((p) => p.id));
      setBouncingClaimIds(ids);
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = setTimeout(() => {
        setBouncingClaimIds(new Set());
      }, 2000);
    } else {
      setBouncingClaimIds(new Set());
    }
    return () => {
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
    };
    // Only re-run when allFlipped or phase changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFlipped, gameState.phase]);

  useEffect(() => {
    if (gameState.message !== previousMessageRef.current) {
      previousMessageRef.current = gameState.message;
      if (gameState.message.includes(" errou! Ronda reiniciada")) {
        const name = gameState.message.split(" errou!")[0];
        setRoundErrorPopup({ name });
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => {
          setRoundErrorPopup(null);
        }, 3000);
      }
    }
  }, [gameState.message]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);


  // ── Flip a card ──
  const handleFlip = useCallback(
    (playerId: number) => {
      const player = gameState.players.find((p) => p.id === playerId);
      if (!player || player.hand.length === 0 || player.currentCard) return;
      if (
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


  useEffect(() => {
    if (gameState.phase === "won") {
      clearRoundTransitionTimers();
      setRoundWinnerPopup(null);
      setRoundCountdown(null);
      previousRoundRef.current = gameState.round;
      return;
    }

    const roundIncreased = gameState.round > previousRoundRef.current;
    const highlightedPlayer =
      gameState.highlightedPlayerId !== null
        ? gameState.players.find((p) => p.id === gameState.highlightedPlayerId)
        : null;

    if (roundIncreased && highlightedPlayer && gameState.phase === "playing") {
      clearRoundTransitionTimers();
      setConfirmingPlayerId(null);
      setRoundCountdown(null);
      setRoundWinnerPopup({
        name: highlightedPlayer.name,
        color: highlightedPlayer.color,
        matchedSlots: gameState.lastMatchSlots,
      });

      roundWinnerTimerRef.current = setTimeout(() => {
        setRoundWinnerPopup(null);
        setRoundCountdown(3);

        roundCountdownTimerRef.current = setInterval(() => {
          setRoundCountdown((prev) => {
            if (prev === null) return null;
            if (prev <= 1) {
              if (roundCountdownTimerRef.current) {
                clearInterval(roundCountdownTimerRef.current);
                roundCountdownTimerRef.current = null;
              }
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }, 3000);
    }

    previousRoundRef.current = gameState.round;
  }, [
    clearRoundTransitionTimers,
    gameState.highlightedPlayerId,
    gameState.phase,
    gameState.players,
    gameState.round,
  ]);

  useEffect(() => {
    return () => {
      clearRoundTransitionTimers();
    };
  }, [clearRoundTransitionTimers]);

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
      const isCorrect = slotsEquivalent(chosenCardSlot, chosenCenterSlot);


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

        // Only the claiming player can win this round: they just discarded their
        // currentCard (by making it the new center). If their hand is also empty
        // they have no cards left → they win. We check by id so we never
        // accidentally assign victory to another player who happens to be at 0.
        const claimingPlayer = updatedPlayers.find((p) => p.id === playerId);
        const winner =
          claimingPlayer?.hand.length === 0 &&
          claimingPlayer?.currentCard === null
            ? claimingPlayer
            : null;

        setHighlightedSlots({ [playerId]: [cardSlotIdx] });

        onGameStateChange({
          ...state,
          players: updatedPlayers,
          centerCard: newCenter,
          centerMatchSlot: chosenCenterSlot,
          lastMatchSlots: { playerSlot: chosenCardSlot, centerSlot: chosenCenterSlot },
          phase: winner ? "won" : "playing",
          winner: winner ?? null,
          round: state.round + 1,
          message: winner
            ? `${player.name} venceu o jogo!`
            : `${player.name} ganhou a ronda! ${matchLabel}`,
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
    if (isRoundTransitioning) return;
    const player = gameState.players[playerId];
    if (!player) return;
    if (
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

  const mobileGridCols =
    gameState.players.length === 4
      ? "grid-cols-1 sm:grid-cols-2"
      : gameState.players.length === 3
        ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";

  const localPlayerInRoom =
    localPlayerName
      ? (gameState.players.find((p) => p.name === localPlayerName) ?? null)
      : null;

  let rotatedPlayers = [...gameState.players];
  if (localPlayerInRoom) {
    const localIdx = rotatedPlayers.findIndex((p) => p.id === localPlayerInRoom.id);
    if (localIdx !== -1) {
      rotatedPlayers = [
        ...rotatedPlayers.slice(localIdx),
        ...rotatedPlayers.slice(0, localIdx),
      ];
    }
  }

  const mobilePlayers = rotatedPlayers;

  let deskTop = null;
  let deskLeft = null;
  let deskRight = null;
  let deskBottom = null;

  if (rotatedPlayers.length === 2) {
    deskLeft = rotatedPlayers[0] ?? null;
    deskRight = rotatedPlayers[1] ?? null;
  } else if (rotatedPlayers.length === 3) {
    deskTop = rotatedPlayers[0] ?? null;
    deskLeft = rotatedPlayers[1] ?? null;
    deskRight = rotatedPlayers[2] ?? null;
  } else if (rotatedPlayers.length === 4) {
    deskTop = rotatedPlayers[0] ?? null;
    deskLeft = rotatedPlayers[1] ?? null;
    deskBottom = rotatedPlayers[2] ?? null;
    deskRight = rotatedPlayers[3] ?? null;
  }

  const renderPlayerZone = (player: Player) => {
    const isLocalPlayer = player.name === localPlayerName;

    return (
      <PlayerZone
        key={player.id}
        player={player}
        isHighlighted={gameState.highlightedPlayerId === player.id}
        highlightedSlots={highlightedSlots[player.id] ?? []}
        onFlip={() => handleFlip(player.id)}
        canFlip={
          isLocalPlayer &&
          !isRoundTransitioning &&
          !player.currentCard &&
          player.hand.length > 0
        }
        onClaim={() => handleClaimOpen(player.id)}
        canClaim={
          isLocalPlayer &&
          !isRoundTransitioning &&
          !!player.currentCard &&
          allFlipped &&
          gameState.phase === "playing"
        }
        isBouncing={bouncingClaimIds.has(player.id)}
      />
    );
  };


  const renderCenterPanel = (className?: string) => (
    <div
      className={cn(
        "rounded-3xl p-3 border-2 flex flex-col items-center gap-3 bg-white shadow-sm",
        className,
      )}
      style={{ borderColor: "var(--border)" }}
    >
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

      <div
        className="w-full rounded-2xl p-3 border"
        style={{ background: "var(--muted)", borderColor: "var(--border)" }}
      >
        <p
          className="text-xs font-black uppercase tracking-widest mb-2 text-center"
          style={{ color: "var(--muted-foreground)" }}
        >
          Cartas em mao
        </p>
        {gameState.players.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: p.color }}
              />
              <span
                className="text-sm font-bold truncate"
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

      {gameState.phase === "playing" && !allFlipped && (
        <div
          className="w-full rounded-2xl p-3 border text-center"
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
          className="w-full rounded-2xl p-3 border text-center"
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
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--background)" }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-start sm:items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b-2"
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
            onClick={() => setShowExitConfirm(true)}
            className="px-3 sm:px-4 py-2 rounded-full border-2 text-xs sm:text-sm font-bold transition-colors hover:bg-muted"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Sair
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

      {/* ── Custom Exit Confirmation Modal ── */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-white rounded-3xl p-6 max-w-[320px] w-full text-center shadow-2xl border-4"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-xl sm:text-2xl font-black mb-2" style={{ color: "var(--foreground)" }}>
              Sair do jogo
            </h2>
            <p className="font-semibold text-sm sm:text-base mb-6" style={{ color: "var(--muted-foreground)" }}>
              Tem a certeza que deseja sair?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 font-black transition-colors hover:bg-muted"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancelar
              </button>
              <button
                onClick={onRestart}
                className="flex-1 py-2.5 sm:py-3 rounded-xl text-white font-black hover:opacity-90 transition-opacity"
                style={{ background: "#ef4444" }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Error overlay ── */}
      {gameState.phase === "playing" && roundErrorPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 transition-all duration-300">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border-4" style={{ borderColor: "#ef4444" }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#fef2f2" }}>
              <span className="text-4xl font-black" style={{ color: "#ef4444" }}>X</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-2" style={{ color: "#ef4444" }}>
              {roundErrorPopup.name} Errou!
            </h2>
            <p className="text-sm font-bold mt-2" style={{ color: "var(--muted-foreground)" }}>
              Ronda reiniciada. Todos devem virar as cartas novamente.
            </p>
          </div>
        </div>
      )}

      {/* ── Round transition overlay ── */}
      {gameState.phase === "playing" &&
        (roundWinnerPopup || roundCountdown !== null) && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border-4 border-white">
              {roundWinnerPopup && (
                <>
                  <p
                    className="text-xs font-black uppercase tracking-widest mb-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Ronda ganha
                  </p>
                  <h2
                    className="text-2xl sm:text-3xl font-black"
                    style={{ color: roundWinnerPopup.color }}
                  >
                    {roundWinnerPopup.name}
                  </h2>
                  {roundWinnerPopup.matchedSlots && (
                    <div className="mt-4 mb-2 flex items-center justify-center gap-4 sm:gap-6 w-full px-2">
                      <div className="flex flex-col items-center flex-1 max-w-[120px]">
                        <div className="w-24 h-24 sm:w-28 sm:h-28">
                          <SlotCell
                            slot={roundWinnerPopup.matchedSlots.playerSlot}
                            accentColor={roundWinnerPopup.color}
                            showVisual={true}
                          />
                        </div>
                        {roundWinnerPopup.matchedSlots.playerSlot.shape !== "none" &&
                         !roundWinnerPopup.matchedSlots.playerSlot.isInteger && (
                          <div className="mt-3 text-lg sm:text-xl font-black bg-black/5 px-4 py-1.5 rounded-full shadow-sm" style={{ color: roundWinnerPopup.color }}>
                            {slotLabel(roundWinnerPopup.matchedSlots.playerSlot)}
                          </div>
                        )}
                      </div>
                      <span className="text-4xl sm:text-5xl font-black text-gray-300">=</span>
                      <div className="flex flex-col items-center flex-1 max-w-[120px]">
                        <div className="w-24 h-24 sm:w-28 sm:h-28">
                          <SlotCell
                            slot={roundWinnerPopup.matchedSlots.centerSlot}
                            accentColor="#22c55e"
                            showVisual={true}
                          />
                        </div>
                        {roundWinnerPopup.matchedSlots.centerSlot.shape !== "none" &&
                         !roundWinnerPopup.matchedSlots.centerSlot.isInteger && (
                          <div className="mt-3 text-lg sm:text-xl font-black bg-black/5 px-4 py-1.5 rounded-full shadow-sm text-green-500">
                            {slotLabel(roundWinnerPopup.matchedSlots.centerSlot)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <p
                    className="text-sm font-semibold mt-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Preparar proxima ronda...
                  </p>
                </>
              )}

              {roundCountdown !== null && (
                <>
                  <p
                    className="text-xs font-black uppercase tracking-widest mb-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Proxima ronda em
                  </p>
                  <div
                    className="text-6xl sm:text-7xl font-black leading-none"
                    style={{ color: "var(--primary)" }}
                  >
                    {roundCountdown}
                  </div>
                </>
              )}
            </div>
          </div>
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
      <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
        {/* Mobile: center card inline (avoid overlay on player zones while scrolling) */}
        <div className="lg:hidden flex flex-col gap-4">
          <div
            className="relative z-0 rounded-3xl border-2 p-3 shadow-lg"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <p
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--muted-foreground)" }}
              >
                Carta do Centro
              </p>
              <span
                className="text-xs font-bold"
                style={{ color: "var(--muted-foreground)" }}
              >
                Ronda {gameState.round}
              </span>
            </div>

            <div className="flex justify-center">
              {gameState.centerCard && (
                <FractionCard
                  card={gameState.centerCard}
                  accentColor="#22c55e"
                  variant="center"
                />
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {gameState.players.map((p) => (
                <span
                  key={p.id}
                  className="px-2.5 py-1 rounded-full text-xs font-black border"
                  style={{
                    color: p.color,
                    borderColor: `${p.color}66`,
                    background: `${p.color}14`,
                  }}
                >
                  {p.name}: {p.hand.length + (p.currentCard ? 1 : 0)}
                </span>
              ))}
            </div>
          </div>

          <div className={cn("grid gap-4 w-full", mobileGridCols)}>
            {mobilePlayers.map((player) => renderPlayerZone(player))}
          </div>
        </div>

        {/* Desktop: table positioning (structure-first, neutral visuals) */}
        {gameState.players.length === 4 ? (
          <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_18rem_minmax(0,1fr)] grid-rows-[auto_auto_auto] gap-5 items-start">
            <div className="col-start-2 row-start-1">
              {deskTop && renderPlayerZone(deskTop)}
            </div>
            <div className="col-start-1 row-start-2 flex justify-end">
              {deskLeft && renderPlayerZone(deskLeft)}
            </div>
            <div className="col-start-2 row-start-2">
              {renderCenterPanel("sticky top-4")}
            </div>
            <div className="col-start-3 row-start-2 flex justify-start">
              {deskRight && renderPlayerZone(deskRight)}
            </div>
            <div className="col-start-2 row-start-3">
              {deskBottom && renderPlayerZone(deskBottom)}
            </div>
          </div>
        ) : gameState.players.length === 3 ? (
          <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_18rem_minmax(0,1fr)] grid-rows-[auto_auto] gap-5 items-start">
            <div className="col-start-2 row-start-1">
              {deskTop && renderPlayerZone(deskTop)}
            </div>
            <div className="col-start-1 row-start-2 flex justify-end">
              {deskLeft && renderPlayerZone(deskLeft)}
            </div>
            <div className="col-start-2 row-start-2">
              {renderCenterPanel("sticky top-4")}
            </div>
            <div className="col-start-3 row-start-2 flex justify-start">
              {deskRight && renderPlayerZone(deskRight)}
            </div>
          </div>
        ) : (
          <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_18rem_minmax(0,1fr)] gap-5 items-start">
            <div className="col-start-1 flex justify-end">{deskLeft && renderPlayerZone(deskLeft)}</div>
            <div className="col-start-2">{renderCenterPanel("sticky top-4")}</div>
            <div className="col-start-3 flex justify-start">{deskRight && renderPlayerZone(deskRight)}</div>
          </div>
        )}
      </main>
    </div>
  );
}
