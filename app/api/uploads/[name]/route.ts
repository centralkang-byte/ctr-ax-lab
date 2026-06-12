import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

// Serves progress photos saved by the LOCAL-DEV fallback of /api/upload (no
// Blob token → files land in data/uploads). In production, image URLs point
// straight at Vercel Blob and this route is never used. Session-gated by the
// middleware like every other route.

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// UUID + whitelisted raster extension, exactly as /api/upload writes them.
// Anything else (dots, slashes, traversal) fails the match — 404.
const NAME_RE = /^[0-9a-f-]{36}\.(png|jpg|gif|webp)$/;

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAME_RE.test(name)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const ext = name.slice(name.lastIndexOf(".") + 1);
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: {
      "Content-Type": MIME_BY_EXT[ext],
      "Cache-Control": "private, max-age=86400", // immutable content (UUID names)
    },
  });
}
