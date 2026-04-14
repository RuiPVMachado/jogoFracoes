import { type GameCard, type GameState, type Player, findMatches, slotLabel } from "./game";

/**
 * AI difficulty levels:
 * - easy:   reacts in 3–5 seconds, 80% accuracy
 * - medium: reacts in 1.5–3 seconds, 90% accuracy
 * - hard:   reacts in 0.5–1.5 seconds, 100% accuracy
 */
export type AIDifficulty = "facil" | "medio" | "dificil";

interface AIConfig {
  minDelay: number;
  maxDelay: number;
  accuracy: number; // 0–1 probability of making the correct move
}

const AI_CONFIG: Record<AIDifficulty, AIConfig> = {
  facil:   { minDelay: 3000, maxDelay: 5000, accuracy: 0.75 },
  medio:   { minDelay: 1500, maxDelay: 3000, accuracy: 0.90 },
  dificil: { minDelay: 500,  maxDelay: 1500, accuracy: 1.00 },
};

/**
 * Returns the delay (ms) until the AI acts, and whether it will find the match.
 */
export function getAIAction(difficulty: AIDifficulty): { delay: number; willMatch: boolean } {
  const cfg = AI_CONFIG[difficulty];
  const delay = cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay);
  const willMatch = Math.random() < cfg.accuracy;
  return { delay: Math.round(delay), willMatch };
}

/**
 * Applies the AI turn to a GameState:
 * - flips the AI's top card
 * - if willMatch and a match exists, claims it immediately and returns the updated state
 * - if willMatch but no match, just flips without claiming (waits for human)
 * - if !willMatch, just flips
 */
export function applyAIFlip(
  state: GameState,
  aiPlayerId: number,
  difficulty: AIDifficulty
): { newState: GameState; aiWillClaim: boolean; claimDelay: number } {
  const aiPlayer = state.players[aiPlayerId];
  if (!aiPlayer || aiPlayer.hand.length === 0) {
    return { newState: state, aiWillClaim: false, claimDelay: 0 };
  }

  // Flip the top card
  const newCard = aiPlayer.hand[0];
  const newHand = aiPlayer.hand.slice(1);

  const updatedPlayers = state.players.map((p) =>
    p.id === aiPlayerId ? { ...p, currentCard: newCard, hand: newHand } : p
  );

  const newState: GameState = { ...state, players: updatedPlayers };

  // Check if there is a match with center
  const matches = state.centerCard ? findMatches(newCard, state.centerCard) : [];
  const { willMatch } = getAIAction(difficulty);
  const aiWillClaim = willMatch && matches.length > 0;
  const { delay: claimDelay } = getAIAction(difficulty);

  return { newState, aiWillClaim, claimDelay: Math.round(claimDelay * 0.3) };
}

/**
 * Returns the label string of the AI's matched slot for the message, e.g. "1/2"
 */
export function aiMatchLabel(card: GameCard, center: GameCard): string {
  const matches = findMatches(card, center);
  if (matches.length === 0) return "";
  const m = matches[0];
  return `${slotLabel(card.slots[m.cardSlotIdx])} = ${slotLabel(center.slots[m.centerSlotIdx])}`;
}
