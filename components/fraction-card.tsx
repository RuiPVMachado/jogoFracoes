"use client";

import { type GameCard, type FractionSlot, slotLabel } from "@/lib/game";
import { cn } from "@/lib/utils";

// ── Visual sub-components ─────────────────────────────────────────────────

function PieVisual({
  filled,
  total,
  color,
}: {
  filled: number;
  total: number;
  color: string;
}) {
  const r = 36;
  const cx = 44;
  const cy = 44;

  if (total === 1) {
    return (
      <svg viewBox="0 0 88 88" className="w-full h-full">
        <circle cx={cx} cy={cy} r={r} fill={filled >= 1 ? color : "#e5e7eb"} />
      </svg>
    );
  }

  const segments = Array.from({ length: total }, (_, i) => {
    const startAngle = (i / total) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((i + 1) / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
    return (
      <path
        key={i}
        d={d}
        fill={i < filled ? color : "#e5e7eb"}
        stroke="white"
        strokeWidth="1.5"
      />
    );
  });

  return (
    <svg viewBox="0 0 88 88" className="w-full h-full">
      {segments}
    </svg>
  );
}

function BarVisual({
  filled,
  total,
  color,
}: {
  filled: number;
  total: number;
  color: string;
}) {
  const blockW = 72 / total;
  return (
    <svg viewBox="0 0 80 28" className="w-full h-full">
      {Array.from({ length: total }, (_, i) => (
        <rect
          key={i}
          x={4 + i * blockW}
          y={2}
          width={blockW - 2}
          height={24}
          rx="3"
          fill={i < filled ? color : "#e5e7eb"}
          stroke="white"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

function SquareVisual({
  filled,
  total,
  color,
}: {
  filled: number;
  total: number;
  color: string;
}) {
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const cw = 72 / cols;
  const ch = 56 / rows;
  return (
    <svg viewBox="0 0 80 64" className="w-full h-full">
      {Array.from({ length: total }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <rect
            key={i}
            x={4 + col * cw}
            y={4 + row * ch}
            width={cw - 2}
            height={ch - 2}
            rx="3"
            fill={i < filled ? color : "#e5e7eb"}
            stroke="white"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

// ── Single slot cell (1 of 6 shown on the card) ───────────────────────────

interface SlotCellProps {
  slot: FractionSlot;
  accentColor: string;
  isHighlighted?: boolean;
  showVisual: boolean;
  /** compact = true when card is small (hand size) */
  compact?: boolean;
}

function SlotCell({
  slot,
  accentColor,
  isHighlighted,
  showVisual,
  compact,
}: SlotCellProps) {
  const filled = slot.numerator;
  const total = slot.denominator;
  const hasVisual = showVisual && slot.shape !== "none";
  const isZero = slot.numerator === 0;
  const isInteger = slot.isInteger || slot.denominator === 1;
  const numFontSize = compact ? "text-base" : "text-lg";
  const intFontSize = compact ? "text-xl" : "text-2xl";

  const highlightStyle = isHighlighted
    ? {
        background: `${accentColor}25`,
        borderColor: accentColor,
        borderWidth: 2,
      }
    : { background: "#f9fafb", borderColor: "#e5e7eb", borderWidth: 1.5 };

  return (
    <div
      className="h-full rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-all"
      style={{ ...highlightStyle, padding: compact ? "2px" : "3px" }}
      aria-label={slotLabel(slot)}
    >
      {/* If a visual exists, show only the shape. */}
      {hasVisual ? (
        <div className="w-full h-full">
          {slot.shape === "circle" && (
            <PieVisual filled={filled} total={total} color={accentColor} />
          )}
          {slot.shape === "bar" && (
            <BarVisual filled={filled} total={total} color={accentColor} />
          )}
          {slot.shape === "square" && (
            <SquareVisual filled={filled} total={total} color={accentColor} />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center leading-none">
          {isZero ? (
            <span
              className={cn("font-black leading-none", intFontSize)}
              style={{ color: accentColor }}
            >
              0
            </span>
          ) : isInteger ? (
            <span
              className={cn("font-black leading-none", intFontSize)}
              style={{ color: accentColor }}
            >
              {slot.numerator}
            </span>
          ) : (
            <>
              <span
                className={cn("font-black leading-none", numFontSize)}
                style={{ color: accentColor }}
              >
                {slot.numerator}
              </span>
              <div
                className="w-5 rounded-full my-0.5"
                style={{ height: 2, background: accentColor }}
              />
              <span
                className={cn("font-black leading-none", numFontSize)}
                style={{ color: accentColor }}
              >
                {slot.denominator}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Back of card ──────────────────────────────────────────────────────────

function CardBack({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl flex items-center justify-center shadow-md select-none",
        className,
      )}
      style={{
        background:
          "repeating-linear-gradient(45deg,#6366f1,#6366f1 5px,#818cf8 5px,#818cf8 14px)",
      }}
      aria-label="Carta virada para baixo"
    >
      <span className="text-white text-4xl font-black opacity-50 select-none">
        ?
      </span>
    </div>
  );
}

// ── Main card component ───────────────────────────────────────────────────

interface FractionCardProps {
  card: GameCard;
  accentColor?: string;
  /** Show card face-down */
  faceDown?: boolean;
  /** Slots to highlight (matched slots) */
  highlightedSlots?: number[];
  /** "hand" = compact stack size, "play" = revealed size, "center" = large center card */
  variant?: "hand" | "play" | "center";
  className?: string;
  onClick?: () => void;
}

function getVisualSlotIndices(cardId: number): Set<number> {
  // Deterministic mix per card: 3 to 4 visual-only slots, remaining numeric-only.
  const visualCount = 3 + (cardId % 2);
  const start = cardId % 6;
  const indices = new Set<number>();

  for (let i = 0; i < visualCount; i++) {
    indices.add((start + i) % 6);
  }

  return indices;
}

export function FractionCard({
  card,
  accentColor = "#ef4444",
  faceDown = false,
  highlightedSlots = [],
  variant = "play",
  className,
  onClick,
}: FractionCardProps) {
  const sizeClasses = {
    hand: "w-20 h-28",
    play: "w-40 h-64",
    center: "w-48 h-72",
  };

  if (faceDown) {
    return <CardBack className={cn(sizeClasses[variant], className)} />;
  }

  const compact = variant === "hand";
  const borderColor = accentColor;
  const isCenter = variant === "center";
  const visualSlotIndices = getVisualSlotIndices(card.id);

  return (
    <div
      className={cn(
        "rounded-2xl flex flex-col shadow-lg border-4 select-none cursor-default overflow-hidden",
        sizeClasses[variant],
        onClick &&
          "cursor-pointer hover:scale-105 active:scale-95 transition-transform",
        className,
      )}
      style={{ background: "#ffffff", borderColor }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={`Carta ${card.id}`}
    >
      {/* Card header: id badge */}
      <div
        className="flex items-center justify-center py-0.5"
        style={{ background: accentColor }}
      >
        <span className="text-white font-black text-xs tracking-wider">
          Carta {card.id}
        </span>
      </div>

      {/* 6 slots in a 2×3 grid */}
      <div
        className={cn(
          "flex-1 grid grid-cols-2 grid-rows-3 gap-1",
          isCenter ? "p-2" : compact ? "p-1" : "p-1.5",
        )}
      >
        {card.slots.map((slot, i) => (
          <SlotCell
            key={i}
            slot={slot}
            accentColor={accentColor}
            isHighlighted={highlightedSlots.includes(i)}
            showVisual={visualSlotIndices.has(i)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
