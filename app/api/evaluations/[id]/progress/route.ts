import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { getEvaluation } from "@/lib/eval-log";
import {
  addProgressUpdate,
  listProgressUpdates,
  listProgressComments,
  canPostProgress,
} from "@/lib/progress-log";
import { identityFromEmail, displayAuthor } from "@/lib/identity";
import { notifyTeams } from "@/lib/notify";

export const runtime = "nodejs";

// Progress feed for one project. Reading is company-wide (same principle as
// proposals — the work is public, only scores are private); posting is for the
// people running the project (author + registered co-workers).

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEvaluation(id);
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const [updates, comments] = await Promise.all([
    listProgressUpdates(id),
    listProgressComments(id),
  ]);

  // Tell the client what the composer should offer this viewer — the POST
  // handlers re-check, this is purely a UI affordance.
  const session = await auth();
  const me = identityFromEmail(session?.user?.email);
  const canPost = canPostProgress(entry, me);
  const canComment = canPost || (await isAdmin(session?.user?.email));

  return NextResponse.json({ updates, comments, canPost, canComment });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEvaluation(id);
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Execution only starts once an admin has approved the project.
  if (entry.status !== "confirmed") {
    return NextResponse.json({ error: "not_confirmed" }, { status: 409 });
  }

  const session = await auth();
  const me = identityFromEmail(session?.user?.email);
  if (!canPostProgress(entry, me)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    body?: string;
    images?: unknown;
    stage?: unknown;
    hoursReturned?: unknown;
  } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const images = Array.isArray(body?.images)
    ? body.images.filter((u): u is string => typeof u === "string" && u.length < 500)
    : [];
  // An update must say or show something.
  if (!text && images.length === 0) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const update = await addProgressUpdate({
    evaluationId: id,
    author: me,
    body: text,
    images,
    stage: body?.stage,
    hoursReturned: body?.hoursReturned,
  });

  const STAGE_KR = { on_track: "순항", delayed: "지연", blocked: "막힘", done: "완료" } as const;
  await notifyTeams(
    `[CTR AX Lab] 진척 업데이트 — ${entry.title ?? entry.text.slice(0, 60)}`,
    [
      `${displayAuthor(me)}${update.stage ? ` · 상태: ${STAGE_KR[update.stage]}` : ""}${
        update.hoursReturned ? ` · 되찾은 시간 ${update.hoursReturned}시간/월` : ""
      }`,
      text.slice(0, 150),
    ],
    id
  );
  return NextResponse.json({ update });
}
