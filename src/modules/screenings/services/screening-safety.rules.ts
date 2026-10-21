import type { RiskCategory } from "../../../generated/prisma/client.js";

export const LOW_CONFIDENCE_PERCENT = 60;
export const HIGH_RISK_TRIGGER_PERCENT = 20;

const riskRank: Record<RiskCategory, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export interface SafetyPrediction {
  confidencePercent: number;
  riskCategory: RiskCategory;
}

export function deriveScreeningSafety(
  predictions: SafetyPrediction[],
  redFlagDetected: boolean,
) {
  const top = predictions[0];
  if (!top) throw new Error("At least one prediction is required");

  const highRiskCandidate = predictions
    .filter((item) =>
      item.confidencePercent > HIGH_RISK_TRIGGER_PERCENT
      && riskRank[item.riskCategory] >= riskRank.HIGH,
    )
    .sort((a, b) => riskRank[b.riskCategory] - riskRank[a.riskCategory])[0];

  const uncertain = top.confidencePercent < LOW_CONFIDENCE_PERCENT;
  const riskLevel: RiskCategory = redFlagDetected
    ? "CRITICAL"
    : highRiskCandidate?.riskCategory ?? top.riskCategory;

  return {
    uncertain,
    riskLevel,
    redFlagDetected,
    naturalCareSuppressed: uncertain || redFlagDetected || riskRank[riskLevel] >= riskRank.HIGH,
    requiresClinicalReview: uncertain || redFlagDetected || highRiskCandidate !== undefined,
  };
}
