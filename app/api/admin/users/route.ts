import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isAdmin,
  listAdmins,
  addAdmin,
  removeAdmin,
  AdminError,
  DEFAULT_ADMIN_EMAIL,
} from "@/lib/admin";
import { identityFromEmail } from "@/lib/identity";

export const runtime = "nodejs";

// Admin user management. Any admin may grant/revoke admin access to other
// accounts on an allowed Workspace domain; the configured owner is protected
// and cannot be removed. Every handler re-checks admin server-side.
async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return (await isAdmin(email)) ? (email as string) : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ admins: await listAdmins(), defaultEmail: DEFAULT_ADMIN_EMAIL });
}

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  try {
    const admins = await addAdmin(typeof body.email === "string" ? body.email : "", identityFromEmail(me));
    return NextResponse.json({ admins });
  } catch (e) {
    return NextResponse.json({ error: e instanceof AdminError ? e.message : "error" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  try {
    const admins = await removeAdmin(typeof body.email === "string" ? body.email : "");
    return NextResponse.json({ admins });
  } catch (e) {
    return NextResponse.json({ error: e instanceof AdminError ? e.message : "error" }, { status: 400 });
  }
}
