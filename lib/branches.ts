export const BRANCH_CODES = ["don-bosco", "alem"] as const;

export type BranchCode = (typeof BRANCH_CODES)[number];

export const DEFAULT_BRANCH: BranchCode = "don-bosco";

export function isBranchCode(value: string): value is BranchCode {
  return BRANCH_CODES.includes(value as BranchCode);
}

export function normalizeBranchCode(value: unknown): BranchCode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isBranchCode(normalized) ? normalized : null;
}

