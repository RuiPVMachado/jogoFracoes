// ── Types ──────────────────────────────────────────────────────────────────

// GameMode removed since it's always multiplayer

/** A single fraction slot on a card — value as num/den, plus optional display shape */
export interface FractionSlot {
  numerator: number;
  denominator: number;
  /** visual shape to show alongside the fraction */
  shape: "circle" | "bar" | "square" | "none";
  /** display as integer (1, 2, 3…) when denominator === 1 */
  isInteger?: boolean;
}

/** One of the 31 game cards — each has exactly 6 fraction slots */
export interface GameCard {
  id: number; // 1–31
  slots: [FractionSlot, FractionSlot, FractionSlot, FractionSlot, FractionSlot, FractionSlot];
}

export interface Player {
  id: number;
  name: string;
  color: string;
  hand: GameCard[]; // cards in hand (face-down stack)
  currentCard: GameCard | null; // card currently played face-up
}

export type GamePhase = "setup" | "playing" | "reviewing" | "won";

export interface GameState {
  players: Player[];
  centerCard: GameCard | null;
  /** The specific slot on the center card that was "matched" (set after a valid match) */
  centerMatchSlot: FractionSlot | null;
  /** The specific fraction slots that were matched in the last winning play */
  lastMatchSlots?: { playerSlot: FractionSlot; centerSlot: FractionSlot };
  phase: GamePhase;
  winner: Player | null;
  round: number;
  message: string;
  /** id of player whose card is currently highlighted as correct */
  highlightedPlayerId: number | null;
  roomCode?: string;
}

// ── The 31-card deck (Dobble-style fraction equivalences) ──────────────────

function slot(n: number, d: number, shape: FractionSlot["shape"] = "none"): FractionSlot {
  return { numerator: n, denominator: d, shape, isInteger: d === 1 };
}

// Assign shapes in rotation for visual variety
const SHAPES: FractionSlot["shape"][] = ["circle", "bar", "square", "circle", "bar", "square"];
function makeSlots(pairs: [number, number][]): GameCard["slots"] {
  return pairs.map(([n, d], i) => slot(n, d, SHAPES[i])) as GameCard["slots"];
}

export const DECK: GameCard[] = [
  { id: 1,  slots: makeSlots([[0,1],[1,1],[2,1],[3,1],[4,1],[5,1]]) },
  { id: 2,  slots: makeSlots([[0,1],[1,2],[1,3],[2,3],[1,4],[3,4]]) },
  { id: 3,  slots: makeSlots([[0,1],[1,5],[2,5],[3,5],[4,5],[1,6]]) },
  { id: 4,  slots: makeSlots([[0,1],[5,6],[1,7],[2,7],[3,7],[1,8]]) },
  { id: 5,  slots: makeSlots([[0,1],[3,8],[5,8],[7,8],[1,9],[2,9]]) },
  { id: 6,  slots: makeSlots([[0,1],[1,10],[3,10],[7,10],[9,10],[1,12]]) },
  { id: 7,  slots: makeSlots([[1,1],[1,2],[1,5],[5,6],[3,8],[1,10]]) },
  { id: 8,  slots: makeSlots([[1,1],[1,3],[2,5],[1,7],[5,8],[3,10]]) },
  { id: 9,  slots: makeSlots([[1,1],[2,3],[3,5],[2,7],[7,8],[7,10]]) },
  { id: 10, slots: makeSlots([[1,1],[1,4],[4,5],[3,7],[1,9],[9,10]]) },
  { id: 11, slots: makeSlots([[1,1],[3,4],[1,6],[1,8],[2,9],[1,12]]) },
  { id: 12, slots: makeSlots([[2,1],[1,2],[2,5],[2,7],[1,9],[1,12]]) },
  { id: 13, slots: makeSlots([[2,1],[1,3],[3,5],[3,7],[2,9],[1,10]]) },
  { id: 14, slots: makeSlots([[2,1],[2,3],[4,5],[1,8],[3,8],[3,10]]) },
  { id: 15, slots: makeSlots([[2,1],[1,4],[1,6],[5,6],[5,8],[7,10]]) },
  { id: 16, slots: makeSlots([[2,1],[3,4],[1,5],[1,7],[7,8],[9,10]]) },
  { id: 17, slots: makeSlots([[3,1],[1,2],[3,5],[1,8],[5,8],[9,10]]) },
  { id: 18, slots: makeSlots([[3,1],[1,3],[4,5],[5,6],[7,8],[1,12]]) },
  { id: 19, slots: makeSlots([[3,1],[2,3],[1,6],[1,7],[1,9],[1,10]]) },
  { id: 20, slots: makeSlots([[3,1],[1,4],[1,5],[2,7],[2,9],[3,10]]) },
  { id: 21, slots: makeSlots([[3,1],[3,4],[2,5],[3,7],[3,8],[7,10]]) },
  { id: 22, slots: makeSlots([[4,1],[1,2],[4,5],[1,7],[2,9],[7,10]]) },
  { id: 23, slots: makeSlots([[4,1],[1,3],[1,6],[2,7],[3,8],[9,10]]) },
  { id: 24, slots: makeSlots([[4,1],[2,3],[1,5],[3,7],[5,8],[1,12]]) },
  { id: 25, slots: makeSlots([[4,1],[1,4],[2,5],[1,8],[7,8],[1,10]]) },
  { id: 26, slots: makeSlots([[4,1],[3,4],[3,5],[5,6],[1,9],[3,10]]) },
  { id: 27, slots: makeSlots([[5,1],[1,2],[1,6],[3,7],[7,8],[3,10]]) },
  { id: 28, slots: makeSlots([[5,1],[1,3],[1,5],[1,8],[1,9],[7,10]]) },
  { id: 29, slots: makeSlots([[5,1],[2,3],[2,5],[5,6],[2,9],[9,10]]) },
  { id: 30, slots: makeSlots([[5,1],[1,4],[3,5],[1,7],[3,8],[1,12]]) },
  { id: 31, slots: makeSlots([[5,1],[3,4],[4,5],[2,7],[5,8],[1,10]]) },
];

// ── Maths helpers ─────────────────────────────────────────────────────────

export function slotValue(s: FractionSlot): number {
  if (s.denominator === 0) return 0;
  return s.numerator / s.denominator;
}

/** Are two slots equivalent fractions? */
export function slotsEquivalent(a: FractionSlot, b: FractionSlot): boolean {
  return Math.abs(slotValue(a) - slotValue(b)) < 0.00001;
}

/**
 * Find all pairs (slotIndexOnCard, slotIndexOnCenter) that are equivalent.
 * Returns an array of matches.
 */
export function findMatches(
  card: GameCard,
  center: GameCard
): Array<{ cardSlotIdx: number; centerSlotIdx: number }> {
  const matches: Array<{ cardSlotIdx: number; centerSlotIdx: number }> = [];
  for (let ci = 0; ci < center.slots.length; ci++) {
    for (let pi = 0; pi < card.slots.length; pi++) {
      if (slotsEquivalent(card.slots[pi], center.slots[ci])) {
        matches.push({ cardSlotIdx: pi, centerSlotIdx: ci });
      }
    }
  }
  return matches;
}

export function hasMatch(card: GameCard, center: GameCard): boolean {
  return findMatches(card, center).length > 0;
}

// ── Display helpers ────────────────────────────────────────────────────────

/** Returns "3/4", "2 inteiros", "0", etc. in PT-PT */
export function slotLabel(s: FractionSlot): string {
  if (s.numerator === 0) return "0";
  if (s.denominator === 1) {
    return s.numerator === 1 ? "1 inteiro" : `${s.numerator} inteiros`;
  }
  return `${s.numerator}/${s.denominator}`;
}

// ── Fisher-Yates shuffle ──────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Room code ─────────────────────────────────────────────────────────────

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Player colours ────────────────────────────────────────────────────────

export const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];

// ── Game initialisation ───────────────────────────────────────────────────

export function initGame(
  playerNames: string[], // human player names (2 to 4)
  roomCode?: string
): GameState {
  const shuffled = shuffle([...DECK]);

  const playerCount = playerNames.length;
  // First card → center
  const centerCard = shuffled[0];
  const rest = shuffled.slice(1);

  // Deal evenly
  const hands: GameCard[][] = Array.from({ length: playerCount }, () => []);
  rest.forEach((card, i) => {
    hands[i % playerCount].push(card);
  });

  const players: Player[] = playerNames.map((name, i) => ({
    id: i,
    name,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    hand: hands[i],
    currentCard: null,
  }));

  return {
    players,
    centerCard,
    centerMatchSlot: null,
    phase: "playing",
    winner: null,
    round: 1,
    message: "Prontos? À contagem de 3... virem as cartas!",
    highlightedPlayerId: null,
    roomCode,
  };
}
