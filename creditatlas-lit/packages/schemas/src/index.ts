export type CreditBrainDecision =
  | "APPROVE"
  | "APPROVE_WITH_CONDITIONS"
  | "REVIEW_POSITIVE"
  | "REVIEW_CAUTION"
  | "DECLINE";

export interface CreditBrainOutput {
  decision: CreditBrainDecision;
  grade: string;
  truth_score: number;
  stress_score: number;
  fraud_score: number;
  suggested_exposure_min: number;
  suggested_exposure_max: number;
  key_positives: string[];
  key_concerns: string[];
  conditions_precedent: string[];
  narrative: string;
}
