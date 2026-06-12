import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getEvaluation,
  listVersions,
  restoreVersion,
  toPublicEntry,
  LockedError,
} from "@/lib/eval-log";
import { identityFromEmail, sameUser } from "@/lib/identity";

export const runtime = "nodejs";

// GET — the full append-only revision history for one proposal.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versions = await listVersions(id);
  // Scores are author-private — same rule as the shared history (commit:
  // "Hide others' scores…"): even admins only see their own scores on this
  // user-facing surface; full cross-user scores live in the admin dashboard.
  // Strip each version's `evaluation` before it reaches the client unless the
  // viewer is the author, so the score never leaks via the version/diff panel.
  // The proposal text itself stays visible.
  const me = identityFromEmail((await auth())?.user?.email);
  const redacted = versions.map((v) =>
    v.author && sameUser(v.author, me) ? v : { ...v, evaluation: undefined }
  );
  return NextResponse.json({ versions: redacted });
}

// POST { version } — restore an old revision as a new highest version. Only the
// original submitter may restore, and not once the entry is confirmed.
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

  const body = (await req.json().catch(() => null)) as { version?: number } | null;
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version < 1) {
    return NextResponse.json({ error: "bad_version" }, { status: 400 });
  }

  try {
    const updated = await restoreVersion(id, version);
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
