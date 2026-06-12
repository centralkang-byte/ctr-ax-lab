import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { listAllEvaluations, listSubmitters } from "@/lib/eval-log";

export const runtime = "nodejs";

// Admin-only cross-user evaluation history. Unlike the public /api/evaluations
// endpoint, this keeps the `submitter` (email id) so the admin can look at a
// specific person's project history. Gated to the admin allow-list.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session?.user?.email))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // The admin reviews submissions, so hide private drafts from both the
  // history list and the Priority Map (which read this endpoint).
  const submitter = req.nextUrl.searchParams.get("submitter")?.trim() || undefined;
  const [entries, submitters] = await Promise.all([
    listAllEvaluations(submitter, 200, { submittedOnly: true }),
    listSubmitters({ submittedOnly: true }),
  ]);

  return NextResponse.json({ entries, submitters });
}
