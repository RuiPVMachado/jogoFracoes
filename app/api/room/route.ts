/**
 * Server-side room state stored in module-level memory.
 * Shared across all requests within the same server process.
 * In production, this would use Supabase Realtime or Redis.
 */

import { NextRequest, NextResponse } from "next/server";
import { initGame, type GameState } from "@/lib/game";

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

interface RoomClosedNotice {
  closedBy: string;
  closedAt: number;
}

// Module-level store — persists for the lifetime of the server process
const rooms = new Map<string, Room>();
const closedRooms = new Map<string, RoomClosedNotice>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Clean up rooms older than 2 hours
function cleanup() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.createdAt < cutoff) rooms.delete(code);
  }

  const closedCutoff = Date.now() - 2 * 60 * 1000;
  for (const [code, closedInfo] of closedRooms) {
    if (closedInfo.closedAt < closedCutoff) closedRooms.delete(code);
  }
}

/** GET /api/room?code=XXXXXX — fetch a room */
export async function GET(req: NextRequest) {
  cleanup();
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
  if (!code)
    return NextResponse.json({ error: "Código em falta." }, { status: 400 });
  const room = rooms.get(code);
  if (!room) {
    const closedInfo = closedRooms.get(code);
    if (closedInfo) {
      return NextResponse.json(
        { error: "Sala encerrada.", closedBy: closedInfo.closedBy },
        { status: 410 },
      );
    }
    return NextResponse.json(
      { error: "Sala não encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json({ room });
}

/** POST /api/room — create a room */
export async function POST(req: NextRequest) {
  cleanup();
  const { hostName, maxPlayers } = await req.json();
  if (!hostName || ![2, 4].includes(maxPlayers)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  // Ensure unique code
  let code = generateCode();
  while (rooms.has(code)) code = generateCode();

  const room: Room = {
    code,
    hostName: String(hostName).trim().slice(0, 20),
    playerNames: [String(hostName).trim().slice(0, 20)],
    maxPlayers,
    status: "waiting",
    createdAt: Date.now(),
    gameState: null,
    gameVersion: 0,
  };
  closedRooms.delete(code);
  rooms.set(code, room);
  return NextResponse.json({ room }, { status: 201 });
}

/** PATCH /api/room — join, start, sync state, or close room */
export async function PATCH(req: NextRequest) {
  cleanup();
  const { action, code, playerName, state, baseVersion } = await req.json();
  const key = String(code ?? "").toUpperCase();
  const room = rooms.get(key);

  if (!room)
    return NextResponse.json(
      { error: "Sala não encontrada. Verifica o código." },
      { status: 404 },
    );

  if (action === "join") {
    if (room.status !== "waiting")
      return NextResponse.json(
        { error: "O jogo já começou. Não podes entrar agora." },
        { status: 400 },
      );
    if (room.playerNames.length >= room.maxPlayers)
      return NextResponse.json(
        { error: "Sala cheia! Não há mais lugares." },
        { status: 400 },
      );
    const name = String(playerName ?? "")
      .trim()
      .slice(0, 20);
    if (!name)
      return NextResponse.json(
        { error: "Escreve o teu nome." },
        { status: 400 },
      );
    if (
      room.playerNames.map((n) => n.toLowerCase()).includes(name.toLowerCase())
    )
      return NextResponse.json(
        { error: "Esse nome já está em uso nesta sala. Escolhe outro." },
        { status: 400 },
      );

    room.playerNames = [...room.playerNames, name];
    rooms.set(key, room);
    return NextResponse.json({ room });
  }

  if (action === "start") {
    const starterName = String(playerName ?? "")
      .trim()
      .slice(0, 20);

    if (
      !starterName ||
      starterName.toLowerCase() !== room.hostName.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Só o anfitrião pode iniciar a partida." },
        { status: 403 },
      );
    }

    if (room.playerNames.length < room.maxPlayers) {
      return NextResponse.json(
        { error: "A sala ainda não está completa." },
        { status: 400 },
      );
    }

    if (!room.gameState) {
      room.gameState = initGame("multiplayer", room.playerNames, room.code);
      room.gameVersion = 1;
    }

    room.status = "playing";
    rooms.set(key, room);
    return NextResponse.json({
      room,
      gameState: room.gameState,
      gameVersion: room.gameVersion,
    });
  }

  if (action === "sync-state") {
    if (room.status !== "playing" || !room.gameState) {
      return NextResponse.json(
        { error: "O jogo ainda não começou nesta sala." },
        { status: 400 },
      );
    }

    const parsedBaseVersion = Number(baseVersion);
    if (!Number.isInteger(parsedBaseVersion)) {
      return NextResponse.json(
        { error: "Versão da partida inválida." },
        { status: 400 },
      );
    }

    if (parsedBaseVersion !== room.gameVersion) {
      return NextResponse.json(
        {
          error:
            "Conflito de sincronização. O estado da sala foi atualizado por outro jogador.",
          gameState: room.gameState,
          gameVersion: room.gameVersion,
        },
        { status: 409 },
      );
    }

    const nextState = state as GameState;
    if (!nextState || nextState.mode !== "multiplayer") {
      return NextResponse.json(
        { error: "Estado de jogo inválido." },
        { status: 400 },
      );
    }

    room.gameState = nextState;
    room.gameVersion += 1;
    rooms.set(key, room);

    return NextResponse.json({
      gameState: room.gameState,
      gameVersion: room.gameVersion,
    });
  }

  if (action === "close") {
    const closerName = String(playerName ?? "")
      .trim()
      .slice(0, 20);

    if (!closerName) {
      return NextResponse.json(
        { error: "Nome do jogador em falta para fechar a sala." },
        { status: 400 },
      );
    }

    const isMember = room.playerNames.some(
      (name) => name.toLowerCase() === closerName.toLowerCase(),
    );

    if (!isMember) {
      return NextResponse.json(
        { error: "Só jogadores da sala podem fechá-la." },
        { status: 403 },
      );
    }

    closedRooms.set(key, {
      closedBy: closerName,
      closedAt: Date.now(),
    });
    rooms.delete(key);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
