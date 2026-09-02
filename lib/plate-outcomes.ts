export type PlateOutcomeId =
  | "out"
  | "strikeout"
  | "walk"
  | "single"
  | "extra_base"
  | "home_run"
  | "reach";

export type PlateOutcomeOption = {
  id: PlateOutcomeId;
  label: string;
  shortLabel: string;
  description: string;
  basePoints: number;
};

export const PLATE_OUTCOME_OPTIONS: PlateOutcomeOption[] = [
  {
    id: "out",
    label: "Out in Play",
    shortLabel: "Out",
    description: "Groundout, flyout, lineout, double play, or sacrifice.",
    basePoints: 12,
  },
  {
    id: "strikeout",
    label: "Strikeout",
    shortLabel: "K",
    description: "The batter is retired on strikes.",
    basePoints: 22,
  },
  {
    id: "walk",
    label: "Walk / HBP",
    shortLabel: "BB/HBP",
    description: "Free pass, hit by pitch, or catcher interference.",
    basePoints: 30,
  },
  {
    id: "single",
    label: "Single",
    shortLabel: "1B",
    description: "One-base hit.",
    basePoints: 34,
  },
  {
    id: "extra_base",
    label: "Double / Triple",
    shortLabel: "XBH",
    description: "Two- or three-base hit.",
    basePoints: 52,
  },
  {
    id: "home_run",
    label: "Home Run",
    shortLabel: "HR",
    description: "Ball leaves the yard.",
    basePoints: 90,
  },
  {
    id: "reach",
    label: "Other Reach",
    shortLabel: "Reach",
    description: "Error, fielder's choice, interference, or uncategorized reach.",
    basePoints: 40,
  },
];

const outcomeLookup = new Map(
  PLATE_OUTCOME_OPTIONS.map((option) => [option.id, option])
);

const outEvents = new Set([
  "field_out",
  "force_out",
  "grounded_into_double_play",
  "double_play",
  "triple_play",
  "sac_fly",
  "sac_bunt",
  "sac_fly_double_play",
  "sac_bunt_double_play",
  "fielders_choice_out",
  "caught_stealing",
  "pickoff_caught_stealing",
]);

const reachEvents = new Set([
  "field_error",
  "fielders_choice",
  "catcher_interf",
  "batter_interference",
  "fan_interference",
]);

function normalizeEventType(eventType: string) {
  return eventType.trim().toLowerCase().replaceAll(" ", "_");
}

export function getPlateOutcomeOption(id: PlateOutcomeId) {
  return outcomeLookup.get(id) ?? PLATE_OUTCOME_OPTIONS[0];
}

export function categorizePlateOutcome(eventType: string): PlateOutcomeId {
  const normalizedType = normalizeEventType(eventType);

  if (normalizedType.includes("strikeout")) {
    return "strikeout";
  }

  if (
    normalizedType === "walk" ||
    normalizedType === "intent_walk" ||
    normalizedType === "hit_by_pitch"
  ) {
    return "walk";
  }

  if (normalizedType === "single") {
    return "single";
  }

  if (normalizedType === "double" || normalizedType === "triple") {
    return "extra_base";
  }

  if (normalizedType === "home_run") {
    return "home_run";
  }

  if (reachEvents.has(normalizedType)) {
    return "reach";
  }

  if (outEvents.has(normalizedType) || normalizedType.includes("out")) {
    return "out";
  }

  return "reach";
}

function partialCredit(
  predictedOutcome: PlateOutcomeId,
  actualOutcome: PlateOutcomeId
) {
  if (predictedOutcome === actualOutcome) {
    return getPlateOutcomeOption(actualOutcome).basePoints;
  }

  const outFamily = new Set<PlateOutcomeId>(["out", "strikeout"]);
  const hitFamily = new Set<PlateOutcomeId>([
    "single",
    "extra_base",
    "home_run",
  ]);
  const reachFamily = new Set<PlateOutcomeId>(["walk", "reach"]);

  if (outFamily.has(predictedOutcome) && outFamily.has(actualOutcome)) {
    return 8;
  }

  if (reachFamily.has(predictedOutcome) && reachFamily.has(actualOutcome)) {
    return 12;
  }

  if (hitFamily.has(predictedOutcome) && hitFamily.has(actualOutcome)) {
    if (
      (predictedOutcome === "home_run" && actualOutcome === "extra_base") ||
      (predictedOutcome === "extra_base" && actualOutcome === "home_run")
    ) {
      return 24;
    }

    return 14;
  }

  return 0;
}

export function timingBonusForPitchCount(pitchCountAtLock: number) {
  if (pitchCountAtLock <= 0) {
    return 8;
  }

  if (pitchCountAtLock === 1) {
    return 4;
  }

  if (pitchCountAtLock === 2) {
    return 2;
  }

  return 0;
}

export function scorePlatePrediction({
  predictedOutcome,
  actualOutcome,
  pitchCountAtLock,
}: {
  predictedOutcome: PlateOutcomeId;
  actualOutcome: PlateOutcomeId;
  pitchCountAtLock: number;
}) {
  const baseScore = partialCredit(predictedOutcome, actualOutcome);
  const timingBonus =
    predictedOutcome === actualOutcome
      ? timingBonusForPitchCount(pitchCountAtLock)
      : 0;

  return {
    baseScore,
    timingBonus,
    totalScore: baseScore + timingBonus,
  };
}
