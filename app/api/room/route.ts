/**
 * Server-side room state stored in Upstash Redis.
 * Shared across all requests and server instances (Vercel/serverless-safe).
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
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

const ROOM_TTL_SECONDS = 60 * 60 * 2;
const CLOSED_ROOM_TTL_SECONDS = 60 * 2;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

function ensureRedis(): Redis {
  if (!redis) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN são obrigatórios.",
    );
  }
  return redis;
}

async function getRoom(code: string): Promise<Room | null> {
  return ensureRedis().get<Room>(`room:${code}`);
}

async function setRoom(room: Room): Promise<void> {
  await ensureRedis().set(`room:${room.code}`, room, {
    ex: ROOM_TTL_SECONDS,
  });
}

async function deleteRoom(code: string): Promise<void> {
  await ensureRedis().del(`room:${code}`);
}

async function getClosedRoom(code: string): Promise<RoomClosedNotice | null> {
  return ensureRedis().get<RoomClosedNotice>(`closed:${code}`);
}

async function setClosedRoom(
  code: string,
  info: RoomClosedNotice,
): Promise<void> {
  await ensureRedis().set(`closed:${code}`, info, {
    ex: CLOSED_ROOM_TTL_SECONDS,
  });
}

async function deleteClosedRoom(code: string): Promise<void> {
  await ensureRedis().del(`closed:${code}`);
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function generateUniqueCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 20) {
    const code = generateCode();
    const existingRoom = await getRoom(code);
    if (!existingRoom) return code;
    attempts += 1;
  }

  throw new Error("Não foi possível gerar um código de sala único.");
}

/** GET /api/room?code=XXXXXX — fetch a room */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
    if (!code)
      return NextResponse.json({ error: "Código em falta." }, { status: 400 });

    const room = await getRoom(code);
    if (!room) {
      const closedInfo = await getClosedRoom(code);
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
  } catch (error) {
    console.error("Erro ao obter sala no Redis:", error);
    return NextResponse.json(
      { error: "Serviço de salas temporariamente indisponível." },
      { status: 500 },
    );
  }
}

/** POST /api/room — create a room */
export async function POST(req: NextRequest) {
  try {
    const { hostName, maxPlayers } = await req.json();
    if (!hostName || ![2, 4].includes(maxPlayers)) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const normalizedHostName = String(hostName).trim().slice(0, 20);
    if (!normalizedHostName) {
      return NextResponse.json(
        { error: "Escreve o nome do anfitrião." },
        { status: 400 },
      );
    }

    const code = await generateUniqueCode();
    const room: Room = {
      code,
      hostName: normalizedHostName,
      playerNames: [normalizedHostName],
      maxPlayers,
      status: "waiting",
      createdAt: Date.now(),
      gameState: null,
      gameVersion: 0,
    };

    await deleteClosedRoom(code);
    await setRoom(room);
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar sala no Redis:", error);
    return NextResponse.json(
      { error: "Não foi possível criar a sala neste momento." },
      { status: 500 },
    );
  }
}

/** PATCH /api/room — join, start, sync state, or close room */
export async function PATCH(req: NextRequest) {
  try {
    const { action, code, playerName, state, baseVersion } = await req.json();
    const key = String(code ?? "").toUpperCase();
    const room = await getRoom(key);

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
        room.playerNames
          .map((n) => n.toLowerCase())
          .includes(name.toLowerCase())
      )
        return NextResponse.json(
          { error: "Esse nome já está em uso nesta sala. Escolhe outro." },
          { status: 400 },
        );

      room.playerNames = [...room.playerNames, name];
      await setRoom(room);
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
      await setRoom(room);
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
      await setRoom(room);

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

      await setClosedRoom(key, {
        closedBy: closerName,
        closedAt: Date.now(),
      });
      await deleteRoom(key);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("Erro ao atualizar sala no Redis:", error);
    return NextResponse.json(
      { error: "Serviço de salas temporariamente indisponível." },
      { status: 500 },
    );
  }
}
