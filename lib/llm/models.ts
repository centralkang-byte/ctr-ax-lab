import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { findProvider, isReasoningModel, type LlmConfig } from "./catalog";

// Turns an admin-chosen LlmConfig into a concrete LangChain chat model that the
// LangGraph nodes can `.invoke()`. Each provider reads its own API key from the
// environment (the same keys already provisioned on Vercel). Reasoning models
// (gpt-5, o4-mini) reject a custom temperature, so it is omitted for those.

function requireKey(env: string): string {
  const key = process.env[env];
  if (!key) {
    throw new Error(`${env} is not set. Add it to the environment to use this provider.`);
  }
  return key;
}

export function makeModel(cfg: LlmConfig): BaseChatModel {
  const providerDef = findProvider(cfg.provider);
  if (!providerDef) throw new Error(`Unknown provider: ${cfg.provider}`);
  const apiKey = requireKey(providerDef.apiKeyEnv);
  const useTemp = !isReasoningModel(cfg.provider, cfg.model);

  switch (cfg.provider) {
    case "openai":
      return new ChatOpenAI({
        apiKey,
        model: cfg.model,
        maxTokens: cfg.maxTokens,
        ...(useTemp ? { temperature: cfg.temperature } : {}),
        maxRetries: 2,
      });
    case "anthropic":
      return new ChatAnthropic({
        apiKey,
        model: cfg.model,
        maxTokens: cfg.maxTokens,
        ...(useTemp ? { temperature: cfg.temperature } : {}),
        maxRetries: 2,
      });
    case "google":
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: cfg.model,
        maxOutputTokens: cfg.maxTokens,
        ...(useTemp ? { temperature: cfg.temperature } : {}),
        maxRetries: 2,
      });
    default: {
      // Exhaustiveness guard — a new provider in the catalog must be handled here.
      const _never: never = cfg.provider;
      throw new Error(`Unhandled provider: ${String(_never)}`);
    }
  }
}
