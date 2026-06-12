import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEvaluation, submitEvaluation, toPublicEntry, LockedError } from "@/lib/eval-log";
import { getSubmitThreshold } from "@/lib/settings";
import { identityFromEmail, sameUser } from "@/lib/identity";

export const runtime = "nodejs";

// Move a draft to `submitted` (ready for admin review). Only the original
// submitter may submit their own entry. Policy gate: the proposal's overall
// score must clear the admin-configured submit threshold.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (!existing.proposal) {
    return NextResponse.json({ error: "no_proposal" }, { status: 400 });
  }
  const threshold = await getSubmitThreshold();
  if (!(existing.overall >= threshold)) {
    return NextResponse.json(
      { error: "below_threshold", threshold, overall: existing.overall },
      { status: 400 }
    );
  }

  try {
    const updated = await submitEvaluation(id);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ entry: toPublicEntry(updated) });
  } catch (err) {
    if (err instanceof LockedError) {
      return NextResponse.json({ error: "locked" }, { status: 409 });
    }
    throw err;
  }
}
