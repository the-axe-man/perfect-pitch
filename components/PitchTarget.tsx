import type { CSSProperties, PointerEvent } from "react";
import type { BatterSide } from "@/lib/mlb-live";

export type PitchView = "catcher" | "pitcher";

export type PitchPoint = {
  x: number;
  y: number;
};

const FIELD_WIDTH = 760;
const FIELD_HEIGHT = 760;
const PLATE_WIDTH_FEET = 17 / 12;
const ZONE_BOTTOM_FEET = 1.5;
const ZONE_TOP_FEET = 3.5;
const ZONE_WIDTH = 206;
const PIXELS_PER_FOOT = ZONE_WIDTH / PLATE_WIDTH_FEET;
const ZONE_HEIGHT = (ZONE_TOP_FEET - ZONE_BOTTOM_FEET) * PIXELS_PER_FOOT;
const ZONE_TOP = 232;
const PLATE_TOP = 666;
const PLATE_HEIGHT = 34;
const RIGHT_HANDED_PLATE_CENTER_X = 458;
const LEFT_HANDED_PLATE_CENTER_X = FIELD_WIDTH - RIGHT_HANDED_PLATE_CENTER_X;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeBatterSide(value: string | null | undefined): BatterSide {
  if (value === "L" || value === "R" || value === "S") {
    return value;
  }

  return "R";
}

function plateCenterX(side: BatterSide) {
  return normalizeBatterSide(side) === "L"
    ? LEFT_HANDED_PLATE_CENTER_X
    : RIGHT_HANDED_PLATE_CENTER_X;
}

function displayX(x: number, view: PitchView) {
  return view === "pitcher" ? FIELD_WIDTH - x : x;
}

function displayRectStyle(
  left: number,
  top: number,
  width: number,
  height: number,
  view: PitchView
): CSSProperties {
  const displayLeft = view === "pitcher" ? FIELD_WIDTH - left - width : left;

  return {
    left: `${(displayLeft / FIELD_WIDTH) * 100}%`,
    top: `${(top / FIELD_HEIGHT) * 100}%`,
    width: `${(width / FIELD_WIDTH) * 100}%`,
    height: `${(height / FIELD_HEIGHT) * 100}%`,
  };
}

function pointStyle(point: PitchPoint, view: PitchView): CSSProperties {
  return {
    left: `${(displayX(point.x, view) / FIELD_WIDTH) * 100}%`,
    top: `${(point.y / FIELD_HEIGHT) * 100}%`,
  };
}

export function plateCoordinatesToPoint(
  plateX: number | null,
  plateZ: number | null,
  batterSide: BatterSide = "R"
): PitchPoint | null {
  if (plateX === null || plateZ === null) {
    return null;
  }

  const centerX = plateCenterX(batterSide);

  return {
    x: clamp(centerX + plateX * PIXELS_PER_FOOT, 12, FIELD_WIDTH - 12),
    y: clamp(
      ZONE_TOP + (ZONE_TOP_FEET - plateZ) * PIXELS_PER_FOOT,
      12,
      FIELD_HEIGHT - 12
    ),
  };
}

function isBatterOnLeft(side: BatterSide, view: PitchView) {
  const normalizedSide = normalizeBatterSide(side);

  return view === "catcher"
    ? normalizedSide !== "L"
    : normalizedSide === "L";
}

function batterStyle(side: BatterSide, view: PitchView): CSSProperties {
  const onLeft = isBatterOnLeft(side, view);
  const isLeftHanded = normalizeBatterSide(side) === "L";

  return {
    backgroundImage: `url(${
      view === "catcher"
        ? "/batter-rh-catcher.png"
        : "/batter-rh-pitcher.png"
    })`,
    backgroundPosition: onLeft ? "left top" : "right top",
    transform: isLeftHanded ? "scaleX(-1)" : undefined,
    transformOrigin: "center",
    ...(onLeft ? { left: "-2.5%" } : { right: "-2.5%" }),
  };
}

export function PitchTarget({
  enabled,
  batterSide = "R",
  guessPoint,
  actualPoint,
  lockedPoint,
  view,
  onPick,
}: {
  enabled: boolean;
  batterSide?: BatterSide;
  guessPoint: PitchPoint | null;
  actualPoint?: PitchPoint | null;
  lockedPoint?: PitchPoint | null;
  view: PitchView;
  onPick: (point: PitchPoint) => void;
}) {
  const normalizedSide = normalizeBatterSide(batterSide);
  const centerX = plateCenterX(normalizedSide);
  const zoneLeft = centerX - ZONE_WIDTH / 2;
  const plateLeft = centerX - ZONE_WIDTH / 2;
  const displayGuess = lockedPoint ?? guessPoint;

  function handlePointer(event: PointerEvent<HTMLDivElement>) {
    if (!enabled) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const displayPointX =
      ((event.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const pointX =
      view === "pitcher" ? FIELD_WIDTH - displayPointX : displayPointX;
    const pointY =
      ((event.clientY - rect.top) / rect.height) * FIELD_HEIGHT;

    onPick({
      x: clamp(pointX, 0, FIELD_WIDTH),
      y: clamp(pointY, 0, FIELD_HEIGHT),
    });
  }

  return (
    <div
      aria-label="Pitch location target"
      onPointerDown={handlePointer}
      className={`relative aspect-square w-full max-w-[760px] overflow-visible ${
        enabled ? "cursor-crosshair" : "cursor-not-allowed"
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[6%] z-0 h-[101%] w-[39%] bg-contain bg-no-repeat opacity-[0.16]"
        style={batterStyle(normalizedSide, view)}
      />

      <div
        aria-hidden="true"
        className="absolute z-10 border-2 border-[#7f8790]/90 shadow-[0_0_18px_rgba(0,0,0,0.1)]"
        style={displayRectStyle(zoneLeft, ZONE_TOP, ZONE_WIDTH, ZONE_HEIGHT, view)}
      >
        <div className="absolute left-1/3 top-0 h-full border-l border-dashed border-[#555c64]/70" />
        <div className="absolute left-2/3 top-0 h-full border-l border-dashed border-[#555c64]/70" />
        <div className="absolute left-0 top-1/3 w-full border-t border-dashed border-[#555c64]/70" />
        <div className="absolute left-0 top-2/3 w-full border-t border-dashed border-[#555c64]/70" />
      </div>

      <div
        aria-hidden="true"
        className="absolute z-10 bg-[#4a5057]/50"
        style={{
          ...displayRectStyle(
            plateLeft,
            PLATE_TOP,
            ZONE_WIDTH,
            PLATE_HEIGHT,
            view
          ),
          clipPath:
            view === "catcher"
              ? "polygon(8% 0, 92% 0, 100% 52%, 50% 100%, 0 52%)"
              : "polygon(50% 0, 100% 48%, 92% 100%, 8% 100%, 0 48%)",
        }}
      />

      {displayGuess && actualPoint && (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
          <line
            x1={`${(displayX(displayGuess.x, view) / FIELD_WIDTH) * 100}%`}
            y1={`${(displayGuess.y / FIELD_HEIGHT) * 100}%`}
            x2={`${(displayX(actualPoint.x, view) / FIELD_WIDTH) * 100}%`}
            y2={`${(actualPoint.y / FIELD_HEIGHT) * 100}%`}
            stroke="#dce1e6"
            strokeDasharray="8 8"
            strokeWidth="3"
          />
        </svg>
      )}

      {displayGuess && (
        <div
          aria-hidden="true"
          className="absolute z-30 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#dce1e6] bg-transparent"
          style={pointStyle(displayGuess, view)}
        />
      )}

      {actualPoint && (
        <div
          aria-hidden="true"
          className="absolute z-30 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#202225] bg-[#dcff00]"
          style={pointStyle(actualPoint, view)}
        />
      )}
    </div>
  );
}
