import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { listAllEvaluations } from "@/lib/eval-log";
import { listProgressOverview, isStale, STALE_AFTER_DAYS } from "@/lib/progress-log";

export const runtime = "nodejs";

// Admin-only execution board: every confirmed project with its latest progress
// activity, a stale flag (no activity for STALE_AFTER_DAYS), and the reported
// actual hours returned. The company-wide hours total is the headline number
// for the AX program — measured T from TIDA, not the predicted one.
export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session?.user?.email))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [entries, overview] = await Promise.all([
    listAllEvaluations(undefined, 500, { submittedOnly: true }),
    listProgressOverview(),
  ]);
  const byId = new Map(overview.map((o) => [o.evaluationId, o]));
  const now = new Date().toISOString();

  const projects = entries
    .filter((e) => e.status === "confirmed")
    .map((e) => {
      const o = byId.get(e.id);
      // A project with no updates yet counts from its approval date.
      const lastActivityAt = o?.lastUpdateAt ?? e.confirmedAt;
      return {
        id: e.id,
        title: e.title ?? e.text.slice(0, 80),
        submitter: e.submitter,
        coworkers: e.coworkers,
        confirmedAt: e.confirmedAt,
        updateCount: o?.updateCount ?? 0,
        lastUpdateAt: o?.lastUpdateAt,
        lastStage: o?.lastStage,
        hoursReturned: o?.hoursReturned,
        stale: o?.lastStage === "done" ? false : isStale(lastActivityAt, now),
      };
    });

  const totalHoursReturned = projects.reduce((sum, p) => sum + (p.hoursReturned ?? 0), 0);

  return NextResponse.json({ projects, totalHoursReturned, staleAfterDays: STALE_AFTER_DAYS });
}
