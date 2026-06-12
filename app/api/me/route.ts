import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { isViewingAsMember } from "@/lib/view-as";

export const runtime = "nodejs";

// Lightweight identity endpoint so client chrome (the header) can decide whether
// to show the Admin link without threading the session through every page.
// Honors the owner-only "view as member" cookie: while it's set, an admin is
// reported as a plain member (isAdmin: false) but with viewingAsMember: true so
// the header can still offer a way back out.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const realAdmin = await isAdmin(email);
  const viewingAsMember = realAdmin && (await isViewingAsMember());
  return NextResponse.json({
    email,
    isAdmin: realAdmin && !viewingAsMember,
    viewingAsMember,
  });
}
