"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { PLAYER_COLORS, type GameState } from "@/lib/game";
import {
  createRoom,
  joinRoom,
  getRoom,
  startRoomGame,
  type Room,
} from "@/lib/room";


interface SetupScreenProps {
  onStartMultiplayer: (
    initialState: GameState,
    localPlayerName: string,
    gameVersion: number,
  ) => void;
}

type SetupStep =
  | "mode"
  | "mp-choice"
  | "mp-create"
  | "mp-join"
  | "mp-lobby";

export function SetupScreen({
  onStartMultiplayer,
}: SetupScreenProps) {
  const [step, setStep] = useState<SetupStep>("mode");

  // Create room
  const [hostName, setHostName] = useState("");
  const [mpPlayerCount, setMpPlayerCount] = useState<2 | 3 | 4>(2);

  // Join room
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState("");

  // Lobby (both host and joiner land here)
  const [lobbyRoom, setLobbyRoom] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [localPlayerName, setLocalPlayerName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  // Poll lobby and start only when the server reports status "playing"
  useEffect(() => {
    if (step !== "mp-lobby" || !lobbyRoom) return;
    startedRef.current = false;

    async function checkFull() {
      if (!lobbyRoom || startedRef.current) return;
      const lookup = await getRoom(lobbyRoom.code);

      if (lookup.status === "unavailable") return;

      if (lookup.status === "closed") {
        toast(`O jogador ${lookup.closedBy} saiu da partida e a sala foi encerrada.`);
        setStep("mp-choice");
        return;
      }

      if (lookup.status === "not-found") {
        toast("A sala foi fechada.");
        setStep("mp-choice");
        return;
      }


      const fresh = lookup.room;
      setLobbyRoom(fresh);

      if (
        fresh.status === "playing" &&
        fresh.gameState &&
        !startedRef.current
      ) {
        startedRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        const fallbackName = isHost ? fresh.hostName : "Jogador";
        onStartMultiplayer(
          fresh.gameState,
          localPlayerName || fallbackName,
          fresh.gameVersion,
        );
        return;
      }
    }

    pollRef.current = setInterval(checkFull, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, lobbyRoom?.code, onStartMultiplayer, isHost, localPlayerName]);

  async function handleHostStartGame() {
    if (!lobbyRoom || !isHost) return;

    const isFull = lobbyRoom.playerNames.length >= lobbyRoom.maxPlayers;
    if (!isFull) {
      toast.error("A sala ainda não está completa.");
      return;
    }


    startedRef.current = true;
    setActionLoading(true);
    const result = await startRoomGame(
      lobbyRoom.code,
      localPlayerName || lobbyRoom.hostName,
    );
    setActionLoading(false);

    if ("error" in result) {
      startedRef.current = false;
      toast.error(result.error);
      return;
    }


    if (pollRef.current) clearInterval(pollRef.current);
    onStartMultiplayer(
      result.gameState,
      localPlayerName || lobbyRoom.hostName,
      result.gameVersion,
    );
  }


  async function handleCreateRoom() {
    const name = hostName.trim() || "Anfitrião";
    setActionLoading(true);
    const result = await createRoom(name, mpPlayerCount);
    setActionLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setLocalPlayerName(name);
    setLobbyRoom(result.room);
    setIsHost(true);
    setStep("mp-lobby");
  }

  async function handleJoinAttempt() {
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    const name = joinName.trim();

    if (code.length !== 6) {
      setJoinError("O código da sala tem 6 caracteres.");
      return;
    }
    if (!name) {
      setJoinError("Escreve o teu nome antes de entrar.");
      return;
    }

    setActionLoading(true);
    const result = await joinRoom(code, name);
    setActionLoading(false);
    if ("error" in result) {
      setJoinError(result.error);
      return;
    }

    setLocalPlayerName(name);
    setLobbyRoom(result.room);
    setIsHost(false);
    setStep("mp-lobby");
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-lg">
        {/* Title */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full shadow-xl mb-4"
            style={{ background: "var(--primary)" }}
          >
            <span className="text-white text-4xl font-black leading-none">
              ½
            </span>
          </div>
          <h1
            className="text-4xl font-black text-balance"
            style={{ color: "var(--foreground)" }}
          >
            Jogo das Frações
          </h1>
          <p
            className="mt-2 font-semibold text-balance"
            style={{ color: "var(--muted-foreground)" }}
          >
            Encontra a fração equivalente mais rápido!
          </p>
        </div>

        {/* ── Mode selection (Root) ── */}
        {step === "mode" && (
          <div className="flex flex-col gap-4">
            <ModeCard
              title="Multijogador Online"
              description="Cria uma sala ou entra com um código para jogar com amigos à distância."
              symbol="◎"
              color="#22c55e"
              onClick={() => setStep("mp-choice")}
            />

            <RulesCard />
          </div>
        )}

        {/* ── MP choice: create or join ── */}
        {step === "mp-choice" && (
          <div className="flex flex-col gap-4">
            <BackButton onClick={() => setStep("mode")} />

            <ModeCard
              title="Criar Sala"
              description="Crias a sala e partilhas o código com os outros jogadores."
              symbol="+"
              color="#22c55e"
              onClick={() => setStep("mp-create")}
            />
            <ModeCard
              title="Entrar numa Sala"
              description="Tens o código de uma sala? Entra aqui."
              symbol="▶"
              color="#f59e0b"
              onClick={() => setStep("mp-join")}
            />

          </div>
        )}

        {/* ── MP create ── */}
        {step === "mp-create" && (
          <Card>
            <BackButton onClick={() => setStep("mp-choice")} />
            <h2
              className="text-xl font-black"
              style={{ color: "var(--foreground)" }}
            >
              Criar Sala
            </h2>

            <Field label="O teu nome (anfitrião)">
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Escreve o teu nome"
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-xl border-2 font-semibold focus:outline-none"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </Field>

            <Field label="Número de jogadores">
              <div className="flex gap-3">
                {([2, 3, 4] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setMpPlayerCount(n)}
                    className="w-16 h-16 rounded-2xl font-black text-2xl border-4 transition-all"
                    style={{
                      background:
                        mpPlayerCount === n ? PLAYER_COLORS[0] : "var(--muted)",
                      color:
                        mpPlayerCount === n
                          ? "#ffffff"
                          : "var(--muted-foreground)",
                      borderColor:
                        mpPlayerCount === n ? PLAYER_COLORS[0] : "transparent",
                      transform:
                        mpPlayerCount === n ? "scale(1.08)" : "scale(1)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>

            <PrimaryButton
              onClick={handleCreateRoom}
              color="#22c55e"
              loading={actionLoading}
            >
              {actionLoading ? "A criar..." : "Criar Sala"}
            </PrimaryButton>
          </Card>
        )}

        {/* ── MP join ── */}
        {step === "mp-join" && (
          <Card>
            <BackButton onClick={() => setStep("mp-choice")} />
            <h2
              className="text-xl font-black"
              style={{ color: "var(--foreground)" }}
            >
              Entrar numa Sala
            </h2>

            <Field label="O teu nome">
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Escreve o teu nome"
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-xl border-2 font-semibold focus:outline-none"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </Field>

            <Field label="Código da sala">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Ex: AB3XY7"
                maxLength={6}
                className="w-full px-4 py-2.5 rounded-xl border-2 font-black text-2xl tracking-widest text-center focus:outline-none uppercase"
                style={{
                  borderColor: joinError ? "#ef4444" : "var(--border)",
                  color: "var(--foreground)",
                  letterSpacing: "0.3em",
                }}
              />
              {joinError && (
                <p
                  className="mt-1.5 text-sm font-semibold"
                  style={{ color: "#ef4444" }}
                >
                  {joinError}
                </p>
              )}
            </Field>

            <PrimaryButton
              onClick={handleJoinAttempt}
              color="#f59e0b"
              loading={actionLoading}
            >
              {actionLoading ? "A entrar..." : "Entrar na Sala"}
            </PrimaryButton>
          </Card>
        )}

        {/* ── Lobby ── */}
        {step === "mp-lobby" && lobbyRoom && (
          <Card>
            <div className="flex flex-col items-center gap-5 text-center">
              {/* Resolve isRoomFull once, outside any IIFE */}
              {(function LobbyContent() {
                const isRoomFull =
                  lobbyRoom.playerNames.length >= lobbyRoom.maxPlayers;
                return (
                  <>
                    <h2
                      className="text-xl font-black"
                      style={{ color: "var(--foreground)" }}
                    >
                      {isHost ? "Sala criada!" : "Entraste na sala!"}
                    </h2>

                    {/* Room code display */}
                    <div className="w-full">
                      <p
                        className="text-xs font-black uppercase tracking-widest mb-2"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Código da sala
                      </p>
                      <div
                        className="py-4 px-6 rounded-2xl text-4xl font-black tracking-widest"
                        style={{
                          background: "var(--muted)",
                          color: "var(--foreground)",
                          letterSpacing: "0.3em",
                        }}
                      >
                        {lobbyRoom.code}
                      </div>
                      {isHost && (
                        <p
                          className="mt-2 text-sm font-semibold"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          Partilha este código com os outros jogadores
                        </p>
                      )}
                    </div>

                    {/* Player slots */}
                    <div className="w-full">
                      <p
                        className="text-xs font-black uppercase tracking-widest mb-3 text-left"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Jogadores ({lobbyRoom.playerNames.length}/
                        {lobbyRoom.maxPlayers})
                      </p>
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: lobbyRoom.maxPlayers }).map(
                          (_, i) => {
                            const name = lobbyRoom.playerNames[i];
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all"
                                style={{
                                  borderColor: name
                                    ? PLAYER_COLORS[i]
                                    : "var(--border)",
                                  background: name
                                    ? `${PLAYER_COLORS[i]}12`
                                    : "var(--muted)",
                                }}
                              >
                                <div
                                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-white shadow-sm"
                                  style={{
                                    background: name
                                      ? PLAYER_COLORS[i]
                                      : "var(--muted-foreground)",
                                  }}
                                >
                                  {name ? (
                                    <span className="text-white font-black text-sm">
                                      {name[0].toUpperCase()}
                                    </span>
                                  ) : (
                                    <span className="text-white font-black text-sm">
                                      ?
                                    </span>
                                  )}
                                </div>
                                <span
                                  className="font-bold text-sm"
                                  style={{
                                    color: name
                                      ? "var(--foreground)"
                                      : "var(--muted-foreground)",
                                  }}
                                >
                                  {name ?? "A aguardar..."}
                                </span>
                                {name && i === 0 && (
                                  <span
                                    className="ml-auto text-xs font-black px-2 py-0.5 rounded-full"
                                    style={{
                                      background: PLAYER_COLORS[0],
                                      color: "#fff",
                                    }}
                                  >
                                    Anfitrião
                                  </span>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>

                    {/* Waiting indicator */}
                    <div className="flex items-center gap-2">
                      <LoadingDots />
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {lobbyRoom.playerNames.length < lobbyRoom.maxPlayers
                          ? `A aguardar ${lobbyRoom.maxPlayers - lobbyRoom.playerNames.length} jogador${lobbyRoom.maxPlayers - lobbyRoom.playerNames.length > 1 ? "es" : ""} para entrar...`
                          : isHost
                            ? "Todos os jogadores entraram. Podes iniciar a partida."
                            : "Todos os jogadores entraram. A aguardar o anfitrião iniciar..."}
                      </span>
                    </div>

                    {isHost && (
                      <button
                        onClick={handleHostStartGame}
                        disabled={!isRoomFull || actionLoading}
                        className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: "#22c55e" }}
                      >
                        {actionLoading ? "A iniciar..." : "Iniciar Partida"}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-md border-2 border-border flex flex-col gap-5">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="block text-xs font-black uppercase tracking-widest"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ModeCard({
  title,
  description,
  symbol,
  color,
  onClick,
}: {
  title: string;
  description: string;
  symbol: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-5 rounded-3xl border-4 text-left transition-all hover:scale-[1.02] active:scale-95 bg-white shadow-md"
      style={{ borderColor: color }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-black"
        style={{ background: `${color}20`, color }}
      >
        {symbol}
      </div>
      <div className="flex-1">
        <p
          className="font-black text-base"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </p>
        <p
          className="text-sm font-semibold mt-0.5"
          style={{ color: "var(--muted-foreground)" }}
        >
          {description}
        </p>
      </div>
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke={color}
        strokeWidth="3"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function RulesCard() {
  const rules = [
    {
      n: "1",
      color: "#ef4444",
      text: "Quando o sinal for dado, todos viram a sua carta ao mesmo tempo.",
    },
    {
      n: "2",
      color: "#3b82f6",
      text: "Cada carta tem 6 frações. Procura uma que seja equivalente a uma das frações da carta do centro.",
    },
    {
      n: "3",
      color: "#22c55e",
      text: 'O primeiro a encontrar diz em voz alta, ex: "1/2 é igual a 3/6".',
    },
    {
      n: "4",
      color: "#f59e0b",
      text: "Se estiver correto, a sua carta passa a ser a nova carta do centro e ele descarta-a.",
    },
    { n: "5", color: "#6366f1", text: "Vence quem ficar sem cartas primeiro." },
  ];
  return (
    <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-border">
      <h2
        className="text-xs font-black uppercase tracking-widest mb-3"
        style={{ color: "var(--muted-foreground)" }}
      >
        Como jogar
      </h2>
      <ul className="flex flex-col gap-2">
        {rules.map((r) => (
          <li
            key={r.n}
            className="flex items-start gap-3 text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            <span
              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black text-xs"
              style={{ background: r.color }}
            >
              {r.n}
            </span>
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-sm font-black self-start"
      style={{ color: "var(--muted-foreground)" }}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Voltar
    </button>
  );
}

function PrimaryButton({
  onClick,
  color,
  loading,
  children,
}: {
  onClick: () => void;
  color: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ background: color }}
    >
      {children}
    </button>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full animate-bounce"
          style={{
            background: "var(--muted-foreground)",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
