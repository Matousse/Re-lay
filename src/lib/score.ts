import type { Verdict } from "@/types/reengagement";

/**
 * The go/no-go node scores three factors; the verdict score is their weighted
 * mean. Weights are product constants, mirrored in the agent prompt.
 */
export const SCORE_FACTORS: {
  key: keyof Verdict["factors"];
  label: string;
  weight: number;
}[] = [
  { key: "signalStrength", label: "Signal strength", weight: 0.4 },
  { key: "lossReasonFit", label: "Loss-reason fit", weight: 0.4 },
  { key: "timing", label: "Timing", weight: 0.2 },
];

export const SCORE_FORMULA = SCORE_FACTORS.map(
  (factor) => `${Math.round(factor.weight * 100)}% ${factor.label.toLowerCase()}`,
).join(" + ");
