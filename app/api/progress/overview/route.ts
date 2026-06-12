import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listProgressOverview } from "@/lib/progress-log";

export const runtime = "nodejs";

// Employee-facing progress summary for the "과제 현황" page. Company-wide read,
// same principle as the proposal feed: progress activity is public, only scores
// are private. Returns a per-project status map (stage / last activity / update
// count) keyed by evaluation id, plus the headline company-wide hours-returned
// total. The richer management board (per-project hours breakdown, stale-project
// triage) stays admin-only in /api/admin/progress.
export async function GET() {
  const session = await auth();
  // Middleware already blocks unauthenticated requests; this is belt-and-braces.
  if (!session?.user?.email) {
    return NextResponse.json({ overview: {}, totalHoursReturned: 0 });
  }

  const rows = await listProgressOverview();
  const overview: Record<string, { stage?: string; lastUpdateAt: string; updateCount: number }> = {};
  let totalHoursReturned = 0;
  for (const r of rows) {
    // Per-project status only — no per-project hours (that's a management
    // detail; employees see returned hours on a project's own progress feed).
    overview[r.evaluationId] = {
      stage: r.lastStage,
      lastUpdateAt: r.lastUpdateAt,
      updateCount: r.updateCount,
    };
    totalHoursReturned += r.hoursReturned ?? 0;
  }

  return NextResponse.json({ overview, totalHoursReturned });
}
