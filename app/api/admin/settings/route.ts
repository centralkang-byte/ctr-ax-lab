import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { getSettings, saveSettings } from "@/lib/settings";
import { PROVIDERS, type Provider } from "@/lib/llm/catalog";

export const runtime = "nodejs";

// Admin-only LLM model configuration. GET returns the active settings plus the
// catalog of selectable providers/models; POST persists a new selection.
async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return (await isAdmin(email)) ? (email as string) : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const settings = await getSettings();
  // Tell the UI whether each provider's API key is configured (presence only —
  // never the value). A keyless provider can be saved but breaks every LLM
  // feature company-wide, so the form badges/blocks it instead of failing later.
  const providers = PROVIDERS.map((p) => ({ ...p, hasKey: !!process.env[p.apiKeyEnv] }));
  return NextResponse.json({ settings, providers });
}

export async function POST(req: NextRequest) {
  const email = await requireAdmin();
  if (!email) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    submitThreshold?: number;
    quadrantThreshold?: number;
  };

  const settings = await saveSettings(
    {
      provider: body.provider as Provider,
      model: typeof body.model === "string" ? body.model : undefined,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
      submitThreshold: typeof body.submitThreshold === "number" ? body.submitThreshold : undefined,
      quadrantThreshold: typeof body.quadrantThreshold === "number" ? body.quadrantThreshold : undefined,
    },
    email
  );

  return NextResponse.json({ settings });
}
