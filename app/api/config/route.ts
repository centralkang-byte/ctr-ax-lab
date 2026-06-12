import { NextResponse } from "next/server";
import { getSubmitThreshold, getQuadrantThreshold } from "@/lib/settings";

export const runtime = "nodejs";

// Lightweight client-facing config: the submit-score gate + the priority-map
// quadrant boundary. Neither is sensitive (just numbers), so it isn't admin-
// gated — but auth middleware still requires a signed-in user. The submit button
// and the priority map read these so they stay in sync with the server-side
// values when an admin changes a threshold.
export async function GET() {
  const [submitThreshold, quadrantThreshold] = await Promise.all([
    getSubmitThreshold(),
    getQuadrantThreshold(),
  ]);
  return NextResponse.json({ submitThreshold, quadrantThreshold });
}
