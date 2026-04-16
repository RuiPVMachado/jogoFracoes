"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { SetupScreen } from "@/components/setup-screen";
import { GameBoard } from "@/components/game-board";
import { type GameState, initGame } from "@/lib/game";
import { closeRoom, getRoom, syncRoomGameState } from "@/lib/room";


interface MultiplayerSession {
  roomCode: string;
  localPlayerName: string;
  gameVersion: number;
}

export default function FracoesGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [multiplayerSession, setMultiplayerSession] =
    useState<MultiplayerSession | null>(null);
  const multiplayerSessionRef = useRef<MultiplayerSession | null>(null);
  const missingRoomPollsRef = useRef(0);

  useEffect(() => {
    multiplayerSessionRef.current = multiplayerSession;
  }, [multiplayerSession]);


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
    if (!session) return;

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
    if (!multiplayerSession || !gameState)
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
          toast(`O oponente ${lookup.closedBy} saiu da partida.`);
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
  }, [multiplayerSession?.roomCode]);

  const handleRestart = useCallback(() => {
    const session = multiplayerSessionRef.current;

    void (async () => {
      if (session) {
        await closeRoom(session.roomCode, session.localPlayerName);
      }

      setMultiplayerSession(null);
      setGameState(null);
    })();
  }, []);

  if (!gameState) {
    return (
      <>
        <Toaster richColors position="top-center" />
        <SetupScreen
          onStartMultiplayer={handleStartMultiplayer}
        />
      </>
    );
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      <GameBoard
        gameState={gameState}
        onGameStateChange={handleGameStateChange}
        localPlayerName={multiplayerSession?.localPlayerName}
        onRestart={handleRestart}
      />
    </>
  );
}

