import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  appendEvaluation,
  listEvaluations,
  listAllEvaluations,
  toPublicEntry,
  redactScoreFor,
} from "@/lib/eval-log";
import { TRACKS, type Locale, type TrackId } from "@/lib/evaluator-meta";
import { identityFromEmail } from "@/lib/identity";

export const runtime = "nodejs";

export async function GET() {
  // The shared, user-facing history. Everyone's submitted/confirmed proposals,
  // plus the signed-in user's OWN non-shared entries: drafts (so a generated
  // one-pager is findable before it's submitted) AND entries bounced back by
  // review (changes_requested / rejected) — those leave the shared list, but
  // the author must still be able to find them to read the feedback and
  // revise/resubmit. Others never see any of these. Scores are hidden from
  // anyone but the author; full cross-user scores live in the admin dashboard
  // (/api/admin/history).
  const session = await auth();
  const me = identityFromEmail(session?.user?.email);
  const shared = await listEvaluations(50);
  const mine = me
    ? (await listAllEvaluations(me, 50)).filter(
        (e) => e.status === "draft" || e.status === "changes_requested" || e.status === "rejected"
      )
    : [];
  const entries = [...mine, ...shared]
    .map(toPublicEntry)
    .map((e) => redactScoreFor(e, me, false));
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  // The score (overall/verdict/quadrant/evaluation) is intentionally NOT accepted
  // here — it can only be set server-side by POST /api/evaluations/[id]/score,
  // which grades the entry's own stored proposal. Accepting a client score would
  // let anyone POST a fabricated 5.0 and clear the submit-threshold gate.
  const body = (await req.json()) as {
    trackId?: string;
    text?: string;
    title?: string;
    proposal?: string;
    locale?: string;
  };

  // Default to the AI-project track — it's the only one the brainstorm flow uses
  // and the rubric dimensions the coach probes come from it.
  const trackId = body?.trackId && body.trackId in TRACKS ? body.trackId : "ai-vibe";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 10) {
    return NextResponse.json({ error: "text_too_short" }, { status: 400 });
  }

  // Attribute the submission to the signed-in user's stable identity (see
  // lib/identity.ts — local part on single-domain, full email on multi-domain).
  // Never trust a client-supplied name.
  const session = await auth();
  const submitter = identityFromEmail(session?.user?.email);

  const locale: Locale = body?.locale === "en" ? "en" : "kr";
  const entry = await appendEvaluation({
    trackId: trackId as TrackId,
    text,
    submitter,
    // Score fields start empty — they're filled only by the server-side score route.
    verdict: "",
    overall: 0,
    quadrant: undefined,
    title: typeof body?.title === "string" ? body.title : undefined,
    proposal: typeof body?.proposal === "string" ? body.proposal : undefined,
    evaluation: undefined,
    locale,
  });

  return NextResponse.json({ entry: toPublicEntry(entry) });
}
