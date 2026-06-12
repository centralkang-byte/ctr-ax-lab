import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEvaluation, setCoworkers, toPublicEntry } from "@/lib/eval-log";
import { identityFromEmail, sameUser, coworkerKeyFromInput } from "@/lib/identity";

export const runtime = "nodejs";

// Replace the co-worker list on a proposal — the author registers a leader (or
// teammate) so they can see the score and follow the project. Author-only, and
// unlike proposal edits this stays allowed after `confirmed`: sharing is
// metadata, not content, so it doesn't violate the approval lock.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = (await req.json().catch(() => null)) as { coworkers?: unknown } | null;
  const raw = Array.isArray(body?.coworkers) ? body.coworkers : null;
  if (!raw || raw.length > 20) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Every entry must normalize to a company identity — reject the whole list
  // otherwise, so a typo'd or foreign-domain address is surfaced to the user
  // instead of silently dropped.
  const keys: string[] = [];
  for (const item of raw) {
    const key = typeof item === "string" ? coworkerKeyFromInput(item) : null;
    if (!key) {
      return NextResponse.json(
        { error: "invalid_coworker", value: String(item).slice(0, 80) },
        { status: 400 }
      );
    }
    keys.push(key);
  }

  const updated = await setCoworkers(id, keys);
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // The caller is the owner (checked above), so the unredacted public shape is
  // fine — same contract as the PATCH route.
  return NextResponse.json({ entry: toPublicEntry(updated) });
}
