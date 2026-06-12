import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listReviews } from "@/lib/eval-log";

export const runtime = "nodejs";

// GET — the append-only review history for one proposal (admin decisions +
// feedback across revision rounds). The author needs to read their own
// feedback, so any signed-in user may fetch it; reviews carry only the admin's
// id and message, never a private score. Mirrors the /versions endpoint.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await auth())?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const reviews = await listReviews(id);
  return NextResponse.json({ reviews });
}
