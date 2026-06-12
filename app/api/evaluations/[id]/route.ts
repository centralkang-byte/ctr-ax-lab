import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEvaluation, updateEvaluation, toPublicEntry, redactScoreFor, LockedError } from "@/lib/eval-log";
import { identityFromEmail, sameUser } from "@/lib/identity";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEvaluation(id);
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Strip `submitter` so it never reaches the client; hide the score from anyone
  // but the author — the proposal text stays visible. Full cross-user scores are
  // an admin-dashboard concern (/api/admin/history), not this shared endpoint.
  const session = await auth();
  const me = identityFromEmail(session?.user?.email);
  return NextResponse.json({ entry: redactScoreFor(toPublicEntry(entry), me, false) });
}

// Update the saved proposal/title — used when the user refines, regenerates, or
// hand-edits the one-pager. The SCORE is deliberately not patchable here: it is
// set only by the server-side score route, so the submit-threshold gate can't be
// bypassed with a fabricated overall. Only the original submitter may patch their
// entry (legacy rows with no submitter stay open to any signed-in user).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    proposal?: string;
  } | null;

  try {
    const updated = await updateEvaluation(id, {
      title: typeof body?.title === "string" ? body.title : undefined,
      proposal: typeof body?.proposal === "string" ? body.proposal : undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ entry: toPublicEntry(updated) });
  } catch (err) {
    // A confirmed proposal is permanently locked.
    if (err instanceof LockedError) {
      return NextResponse.json({ error: "locked" }, { status: 409 });
    }
    throw err;
  }
}
