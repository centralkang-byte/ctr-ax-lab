import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { deleteEvaluation } from "@/lib/eval-log";

export const runtime = "nodejs";

// Admin-only deletion of a single history entry. Re-checks isAdmin server-side
// (never trust the client hiding the button) — same gate as the GET sibling.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!(await isAdmin(session?.user?.email))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const removed = await deleteEvaluation(id);
  if (!removed) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}
