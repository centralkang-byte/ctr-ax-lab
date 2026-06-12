import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { auth } from "@/auth";

export const runtime = "nodejs";

// Progress-photo upload. Mirrors the storage split used everywhere else in this
// app: Vercel Blob when a token is configured (production), a local data/
// folder otherwise (dev — served back by /api/uploads/[name], session-gated by
// the middleware). Blob files are `access: "public"` under an unguessable UUID
// name — same pragmatic model as chat-tool file links; don't put anything more
// sensitive than progress photos through this.

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// Only plain raster images — keeps the dev file server's content-type mapping
// trivial and excludes SVG (scriptable) by construction.
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large", maxBytes: MAX_BYTES }, { status: 400 });
  }

  const name = `${crypto.randomUUID()}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`progress/${name}`, file, {
      access: "public",
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/api/uploads/${name}` });
}
