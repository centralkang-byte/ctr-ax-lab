// Segmented-control tab rail: a subtle inset track with a soft filled pill for
// the active tab (no per-button border or accent underline, so the selected tab
// reads as one cohesive control rather than a boxed-out chip).
export const UI_TAB_STYLES = {
  rail: "inline-flex items-center gap-1 rounded-lg border border-border/50 bg-panel2/40 p-1",
  buttonBase: "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
  buttonActive: "bg-primary/15 text-text",
  buttonInactive: "text-muted hover:bg-primary/5 hover:text-text"
} as const;

export function uiAxisTone(grade?: string) {
  if (grade === "Good") {
    return "border-success/50 bg-success/10 text-success";
  }
  if (grade === "NeedImprove") {
    return "border-destructive/50 bg-destructive/10 text-destructive";
  }
  return "border-info/50 bg-info/10 text-info";
}

export function pillKindTone(kind: "OBJ" | "KR"): string {
  if (kind === "KR") {
    return "border-border bg-panel2 text-text";
  }
  return "border-info/50 bg-info/10 text-info";
}

/** Theme-safe pill tone for Objective Type (회사/조직/개인) in table cells. Uses accent tokens so light/dark are consistent. */
export function pillGoalTypeTone(type: "Company" | "Org" | "Individual"): string {
  if (type === "Company") return "border-accent1/50 bg-accent1/15 text-accent1";
  if (type === "Individual") return "border-accent3/50 bg-accent3/15 text-accent3";
  return "border-accent2/50 bg-accent2/15 text-accent2";
}

export function pillImportanceTone(weight?: number | string | null): string {
  const num = typeof weight === "string" ? Number(weight) : (weight ?? NaN);
  if (!Number.isFinite(num) || num <= 0) {
    return "border-border/60 text-muted";
  }
  if (num >= 3) return "border-warning/50 bg-warning/10 text-warning";
  if (num >= 2) return "border-info/50 bg-info/10 text-info";
  return "border-border/50 bg-panel2/50 text-muted";
}

/** Label for importance weight for display (높음/중간/낮음/미배정). */
export function pillImportanceLabel(weight?: number | string | null): string {
  const num = typeof weight === "string" ? Number(weight) : (weight ?? NaN);
  if (!Number.isFinite(num) || num <= 0) return "미배정";
  if (num >= 3) return "높음";
  if (num >= 2) return "중간";
  return "낮음";
}
