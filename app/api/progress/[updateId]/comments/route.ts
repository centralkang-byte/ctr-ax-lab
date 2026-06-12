import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { getEvaluation } from "@/lib/eval-log";
import { addProgressComment, getProgressUpdate, canCommentProgress } from "@/lib/progress-log";
import { identityFromEmail, displayAuthor } from "@/lib/identity";
import { notifyTeams } from "@/lib/notify";

export const runtime = "nodejs";

// Feedback comment under one progress update — the admin's channel back to the
// team (and the team's replies). Allowed for admins, the author, and registered
// co-workers; enforced here server-side, never by the client hiding the box.
export async function POST(req: Request, { params }: { params: Promise<{ updateId: string }> }) {
  const { updateId } = await params;
  const update = await getProgressUpdate(updateId);
  if (!update) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const entry = await getEvaluation(update.evaluationId);
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await auth();
  const me = identityFromEmail(session?.user?.email);
  const admin = await isAdmin(session?.user?.email);
  if (!canCommentProgress(entry, me, admin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const comment = await addProgressComment({
    updateId,
    evaluationId: update.evaluationId,
    author: me,
    body: text,
  });

  await notifyTeams(
    `[CTR AX Lab] 진척 피드백 — ${entry.title ?? entry.text.slice(0, 60)}`,
    [`${displayAuthor(me)}${admin ? " (관리자)" : ""}`, text.slice(0, 150)],
    update.evaluationId
  );
  return NextResponse.json({ comment });
}
