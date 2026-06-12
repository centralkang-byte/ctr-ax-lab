// The set of LLM providers and models the admin may bind the evaluation graph
// to. Pure data — safe to import from both client (the admin form) and server
// (the model factory). Keep this list curated rather than fetching live model
// lists so the dropdown never offers a model the graph can't actually drive.
//
// CTR runs Claude company-wide, so the picker offers Anthropic ONLY. The
// `Provider` union and the openai/google branches in models.ts are kept intact
// (they're harmless when nothing selects them) so a provider can be re-added by
// just putting it back in PROVIDERS below — no factory or type changes needed.

export type Provider = "openai" | "anthropic" | "google";

export interface ModelOption {
  id: string;
  label: string;
  /** Reasoning models reject a custom `temperature` — the factory omits it. */
  reasoning?: boolean;
}

export interface ProviderDef {
  id: Provider;
  label: string;
  /** Env var that must hold the API key for this provider to be usable. */
  apiKeyEnv: string;
  models: ModelOption[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
  },
];

export interface LlmConfig {
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
}

// Defaults for CTR: Anthropic Claude Sonnet (CTR runs Claude company-wide).
// Provider is pinned to anthropic — the only one in PROVIDERS — so the default
// always resolves to a provider the catalog actually offers (a stale
// LLM_PROVIDER=openai would otherwise make normalizeConfig's findProvider(...)!
// blow up). The model env var still lets an operator seed a different Claude
// model before /admin is first used.
export const DEFAULT_CONFIG: LlmConfig = {
  provider: "anthropic",
  model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
  temperature: Number(process.env.LLM_TEMPERATURE ?? 0.3) || 0.3,
  maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 1200) || 1200,
};

export function findProvider(provider: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === provider);
}

export function isReasoningModel(provider: Provider, model: string): boolean {
  return findProvider(provider)?.models.find((m) => m.id === model)?.reasoning === true;
}

// Validate a config against the catalog, falling back to defaults for anything
// unknown. Used when reading persisted settings that may predate a catalog edit.
export function normalizeConfig(input: Partial<LlmConfig> | null | undefined): LlmConfig {
  const provider = findProvider(String(input?.provider)) ? (input!.provider as Provider) : DEFAULT_CONFIG.provider;
  const providerDef = findProvider(provider)!;
  const model = providerDef.models.some((m) => m.id === input?.model)
    ? (input!.model as string)
    : providerDef.models[0].id;
  const temperature = Number.isFinite(input?.temperature)
    ? Math.max(0, Math.min(2, Number(input!.temperature)))
    : DEFAULT_CONFIG.temperature;
  const maxTokens = Number.isFinite(input?.maxTokens)
    ? Math.max(256, Math.min(8192, Math.round(Number(input!.maxTokens))))
    : DEFAULT_CONFIG.maxTokens;
  return { provider, model, temperature, maxTokens };
}
