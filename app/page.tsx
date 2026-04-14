"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SetupScreen } from "@/components/setup-screen";
import { GameBoard } from "@/components/game-board";
import { type GameState, initGame } from "@/lib/game";
import { type AIDifficulty } from "@/lib/ai";
import { closeRoom, getRoom, syncRoomGameState } from "@/lib/room";

interface MultiplayerSession {
  roomCode: string;
  localPlayerName: string;
  gameVersion: number;
}

export default function FracoesGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>("medio");
  const [multiplayerSession, setMultiplayerSession] =
    useState<MultiplayerSession | null>(null);
  const multiplayerSessionRef = useRef<MultiplayerSession | null>(null);
  const missingRoomPollsRef = useRef(0);

  useEffect(() => {
    multiplayerSessionRef.current = multiplayerSession;
  }, [multiplayerSession]);

  function handleStartAI(playerName: string, difficulty: AIDifficulty) {
    setAIDifficulty(difficulty);
    setMultiplayerSession(null);
    setGameState(initGame("ai", [playerName]));
  }

  function handleStartMultiplayer(
    initialState: GameState,
    localPlayerName: string,
    gameVersion: number,
  ) {
    setMultiplayerSession({
      roomCode: initialState.roomCode ?? "",
      localPlayerName,
      gameVersion,
    });
    setGameState(initialState);
  }

  const handleGameStateChange = useCallback(async (nextState: GameState) => {
    setGameState(nextState);

    const session = multiplayerSessionRef.current;
    if (!session || nextState.mode !== "multiplayer") return;

    const result = await syncRoomGameState(
      session.roomCode,
      nextState,
      session.gameVersion,
    );
    if ("error" in result) {
      if (result.conflict) {
        setGameState(result.conflict.gameState);
        const nextSession = {
          ...session,
          gameVersion: result.conflict.gameVersion,
        };
        multiplayerSessionRef.current = nextSession;
        setMultiplayerSession(nextSession);
      }
      return;
    }

    const nextSession = { ...session, gameVersion: result.gameVersion };
    multiplayerSessionRef.current = nextSession;
    setMultiplayerSession(nextSession);
  }, []);

  useEffect(() => {
    if (!multiplayerSession || !gameState || gameState.mode !== "multiplayer")
      return;

    let active = true;
    const intervalId = setInterval(async () => {
      const session = multiplayerSessionRef.current;
      if (!session) return;

      const lookup = await getRoom(session.roomCode);
      if (!active) return;

      if (lookup.status === "unavailable") return;

      if (lookup.status === "closed") {
        if (
          lookup.closedBy &&
          lookup.closedBy.toLowerCase() !==
            session.localPlayerName.toLowerCase()
        ) {
          alert(`O oponente ${lookup.closedBy} saiu da partida.`);
        }

        setMultiplayerSession(null);
        setGameState(null);
        return;
      }

      if (lookup.status === "not-found") {
        missingRoomPollsRef.current += 1;
        if (missingRoomPollsRef.current >= 3) {
          setMultiplayerSession(null);
          setGameState(null);
        }
        return;
      }

      const room = lookup.room;

      missingRoomPollsRef.current = 0;
      if (!room.gameState) return;

      if (room.gameVersion > session.gameVersion) {
        setGameState(room.gameState);
        const nextSession = { ...session, gameVersion: room.gameVersion };
        multiplayerSessionRef.current = nextSession;
        setMultiplayerSession(nextSession);
      }
    }, 700);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [multiplayerSession?.roomCode, gameState?.mode]);

  const handleRestart = useCallback(() => {
    const session = multiplayerSessionRef.current;

    void (async () => {
      if (session && gameState?.mode === "multiplayer") {
        await closeRoom(session.roomCode, session.localPlayerName);
      }

      setMultiplayerSession(null);
      setGameState(null);
    })();
  }, [gameState?.mode]);

  if (!gameState) {
    return (
      <SetupScreen
        onStartAI={handleStartAI}
        onStartMultiplayer={handleStartMultiplayer}
      />
    );
  }

  return (
    <GameBoard
      gameState={gameState}
      aiDifficulty={aiDifficulty}
      onGameStateChange={handleGameStateChange}
      localPlayerName={multiplayerSession?.localPlayerName}
      onRestart={handleRestart}
    />
  );
}
