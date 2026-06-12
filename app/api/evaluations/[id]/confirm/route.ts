import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { confirmEvaluation, toPublicEntry } from "@/lib/eval-log";
import { identityFromEmail } from "@/lib/identity";

export const runtime = "nodejs";

// Admin-only: confirm a proposal. This is the terminal, locking transition —
// afterwards the proposal/score/status can no longer change (enforced in
// updateEvaluation via LockedError). Gated to the admin allow-list.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!(await isAdmin(email))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const adminId = identityFromEmail(email);
  const updated = await confirmEvaluation(id, adminId);
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ entry: toPublicEntry(updated) });
}
