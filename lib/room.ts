/**
 * Client-side room helpers — all state lives on the server via /api/room.
 * Works across different browser tabs, devices, and locations.
 */

import { type GameState } from "@/lib/game";

export type RoomStatus = "waiting" | "playing";

export interface Room {
  code: string;
  hostName: string;
  playerNames: string[];
  maxPlayers: 2 | 4;
  status: RoomStatus;
  createdAt: number;
  gameState: GameState | null;
  gameVersion: number;
}

export interface SyncConflict {
  gameState: GameState;
  gameVersion: number;
}

export type RoomLookupResult =
  | { status: "ok"; room: Room }
  | { status: "closed"; closedBy: string }
  | { status: "not-found" }
  | { status: "unavailable" };

/** Create a new room. Returns the room on success or an error string. */
export async function createRoom(
  hostName: string,
  maxPlayers: 2 | 4,
): Promise<{ room: Room } | { error: string }> {
  const res = await fetch("/api/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostName, maxPlayers }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? "Erro ao criar sala." };
  return { room: data.room };
}

/** Join an existing room. Returns the updated room or an error string. */
export async function joinRoom(
  code: string,
  playerName: string,
): Promise<{ room: Room } | { error: string }> {
  const res = await fetch("/api/room", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "join",
      code: code.toUpperCase(),
      playerName,
    }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? "Erro ao entrar na sala." };
  return { room: data.room };
}

/** Fetch the latest room status, including closure metadata when available. */
export async function getRoom(code: string): Promise<RoomLookupResult> {
  try {
    const res = await fetch(`/api/room?code=${code.toUpperCase()}`, {
      cache: "no-store",
    });
    if (res.status === 404) return { status: "not-found" };
    if (res.status === 410) {
      const data = await res.json();
      return { status: "closed", closedBy: data.closedBy ?? "Oponente" };
    }
    if (!res.ok) return { status: "unavailable" };

    const data = await res.json();
    if (!data.room) return { status: "not-found" };
    return { status: "ok", room: data.room };
  } catch {
    return { status: "unavailable" };
  }
}

/** Start the multiplayer game once and receive the shared initial state. */
export async function startRoomGame(
  code: string,
  playerName: string,
): Promise<
  { room: Room; gameState: GameState; gameVersion: number } | { error: string }
> {
  const res = await fetch("/api/room", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "start",
      code: code.toUpperCase(),
      playerName,
    }),
  });

  const data = await res.json();
  if (!res.ok) return { error: data.error ?? "Erro ao iniciar a partida." };
  return {
    room: data.room,
    gameState: data.gameState,
    gameVersion: data.gameVersion,
  };
}

/**
 * Push a new multiplayer game state with optimistic concurrency control.
 * Returns conflict info when another player updated first.
 */
export async function syncRoomGameState(
  code: string,
  state: GameState,
  baseVersion: number,
): Promise<
  | { gameState: GameState; gameVersion: number }
  | { error: string; conflict?: SyncConflict }
> {
  const res = await fetch("/api/room", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sync-state",
      code: code.toUpperCase(),
      state,
      baseVersion,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (
      res.status === 409 &&
      data.gameState &&
      Number.isInteger(data.gameVersion)
    ) {
      return {
        error: data.error ?? "Conflito de sincronização.",
        conflict: {
          gameState: data.gameState,
          gameVersion: data.gameVersion,
        },
      };
    }
    return { error: data.error ?? "Erro ao sincronizar a partida." };
  }

  return {
    gameState: data.gameState,
    gameVersion: data.gameVersion,
  };
}

/** Close a room for all players. */
export async function closeRoom(
  code: string,
  playerName: string,
): Promise<{ ok: true } | { error: string }> {
  const res = await fetch("/api/room", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "close",
      code: code.toUpperCase(),
      playerName,
    }),
  });

  const data = await res.json();
  if (!res.ok) return { error: data.error ?? "Erro ao fechar sala." };
  return { ok: true };
}
