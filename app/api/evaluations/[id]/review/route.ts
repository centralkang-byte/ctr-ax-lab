import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { reviewEvaluation, toPublicEntry, LockedError, type ReviewDecision } from "@/lib/eval-log";
import { identityFromEmail, displayAuthor } from "@/lib/identity";
import { notifyTeams } from "@/lib/notify";

export const runtime = "nodejs";

const ALLOWED: ReviewDecision[] = ["approved", "changes_requested", "rejected", "reopened"];

// Admin-only: record a review decision on a proposal. One route for the whole
// review surface — approve (locks), request updates, reject, or reopen. Gated to
// the admin allow-list; illegal transitions return 409 (LockedError).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!(await isAdmin(email))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    decision?: string;
    feedback?: string;
  } | null;
  const decision = body?.decision as ReviewDecision | undefined;
  if (!decision || !ALLOWED.includes(decision)) {
    return NextResponse.json({ error: "bad_decision" }, { status: 400 });
  }
  const feedback = typeof body?.feedback === "string" ? body.feedback : "";

  // Both bounce-backs must carry a reason the author can act on — the UI
  // enforces this too, but the server is the gate that can't be bypassed.
  if ((decision === "changes_requested" || decision === "rejected") && !feedback.trim()) {
    return NextResponse.json({ error: "feedback_required" }, { status: 400 });
  }

  const adminId = identityFromEmail(email);
  try {
    const updated = await reviewEvaluation(id, adminId, decision, feedback);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    // Decision labels mirror the UI status chips (kr — the channel is Korean).
    const DECISION_KR: Record<ReviewDecision, string> = {
      approved: "승인",
      changes_requested: "수정 요청",
      rejected: "선정 안 됨",
      reopened: "재검토",
    };
    await notifyTeams(
      `[CTR AX Lab] 검토 결과: ${DECISION_KR[decision]} — ${updated.title ?? updated.text.slice(0, 60)}`,
      [`작성자 ${displayAuthor(updated.submitter)} · 검토자 ${displayAuthor(adminId)}`],
      id
    );
    return NextResponse.json({ entry: toPublicEntry(updated) });
  } catch (err) {
    if (err instanceof LockedError) {
      return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
    }
    throw err;
  }
}
