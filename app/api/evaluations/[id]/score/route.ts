import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEvaluation, updateEvaluation, toPublicEntry, LockedError } from "@/lib/eval-log";
import { getActiveLlmConfig } from "@/lib/settings";
import { scoreProposal } from "@/lib/llm/score";
import { checkRateLimit, logLlmCall } from "@/lib/llm-usage";
import { identityFromEmail, sameUser } from "@/lib/identity";
import type { Locale } from "@/lib/evaluator-meta";

export const runtime = "nodejs";

// Score a saved proposal SERVER-SIDE and persist the result atomically. This is
// the only path that may set an entry's score: the public PATCH no longer
// accepts a client-supplied `evaluation`/`overall`, so the submit-threshold gate
// can't be bypassed by POSTing a fabricated 5.0. The model scores the entry's
// OWN stored text + proposal — the client never supplies the content to grade.
// Only the author may (re-)score their own entry.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await getEvaluation(id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await auth();
  const me = identityFromEmail(session?.user?.email);
  if (existing.submitter && !sameUser(existing.submitter, me)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!existing.proposal || existing.proposal.trim().length < 20) {
    return NextResponse.json({ error: "no_proposal" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { locale?: string } | null;
  const locale: Locale = body?.locale === "en" ? "en" : "kr";

  // Per-user hourly budget (outside-voice finding #7): scoring is the heavier
  // call, capped tighter than the coach.
  const limit = await checkRateLimit(me, "score");
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          locale === "kr"
            ? `시간당 채점 한도(${limit.cap}회)를 초과했습니다. 잠시 후 다시 시도해 주세요.`
            : `Hourly scoring limit (${limit.cap}) reached. Please try again later.`,
      },
      { status: 429 }
    );
  }

  try {
    const base = await getActiveLlmConfig();
    // Scoring wants consistency over warmth and enough room for the rationales.
    const cfg = { ...base, temperature: 0.2, maxTokens: 1400 };
    // Count this call toward the hourly budget + usage log (never blocks).
    await logLlmCall({ submitter: me, route: "score", model: cfg.model });
    const result = await scoreProposal(existing.text, existing.proposal, locale, cfg);
    // updateEvaluation derives overall/quadrant/verdict from the evaluation and
    // throws LockedError if the entry is already confirmed (terminal lock).
    const updated = await updateEvaluation(id, { evaluation: result });
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ score: result, entry: toPublicEntry(updated) });
  } catch (err) {
    if (err instanceof LockedError) {
      return NextResponse.json({ error: "locked" }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : "score_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
