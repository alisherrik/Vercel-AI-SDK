import "server-only";

import type { LanguageModelV3 } from "@ai-sdk/provider";
import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { extractJsonMiddleware, wrapLanguageModel } from "ai";

type SupportedProvider = "gateway" | "openai" | "openrouter";

export function getPlannerModel(): LanguageModelV3 {
  const provider = resolveProvider();

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Missing OPENAI_API_KEY. Set OPENAI_API_KEY or switch AI_PROVIDER to gateway.",
      );
    }

    const isGroq = process.env.OPENAI_BASE_URL?.toLowerCase().includes("groq.com");

    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
      ...(isGroq ? { compatibility: "compatible" } : {}),
    });

    const modelId = process.env.AI_MODEL?.trim() || "gpt-4.1-mini";

    if (isGroq) {
      return withJsonExtraction(
        openai.chat(modelId),
      );
    }

    return withJsonExtraction(openai(modelId));
  }

  if (provider === "openrouter") {
    const apiKey =
      process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error(
        "Missing OPENROUTER_API_KEY. Set OPENROUTER_API_KEY or use AI_PROVIDER=openai with OPENAI_API_KEY.",
      );
    }

    const headers = {
      ...(process.env.OPENROUTER_HTTP_REFERER?.trim()
        ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER.trim() }
        : {}),
      ...(process.env.OPENROUTER_X_TITLE?.trim()
        ? { "X-Title": process.env.OPENROUTER_X_TITLE.trim() }
        : {}),
    };

    const openrouter = createOpenRouter({
      apiKey,
      baseURL:
        process.env.OPENROUTER_BASE_URL?.trim() ||
        process.env.OPENAI_BASE_URL?.trim() ||
        undefined,
      compatibility: "strict",
      headers,
    });

    return withJsonExtraction(
      openrouter.chat(process.env.AI_MODEL?.trim() || "openrouter/free"),
    );
  }

  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;

  if (!gatewayApiKey) {
    throw new Error(
      "Missing AI_GATEWAY_API_KEY. Set AI_GATEWAY_API_KEY or switch AI_PROVIDER to openai.",
    );
  }

  const gateway = createGateway({
    apiKey: gatewayApiKey,
  });

  return withJsonExtraction(
    gateway(process.env.AI_MODEL?.trim() || "openai/gpt-5.4-mini"),
  );
}

function resolveProvider(): SupportedProvider {
  const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const openAiBaseUrl = process.env.OPENAI_BASE_URL?.trim().toLowerCase();

  if (
    configuredProvider === "openai" ||
    configuredProvider === "gateway" ||
    configuredProvider === "openrouter"
  ) {
    if (
      configuredProvider === "openai" &&
      openAiBaseUrl?.includes("openrouter.ai")
    ) {
      return "openrouter";
    }

    return configuredProvider;
  }

  if (process.env.OPENROUTER_API_KEY || openAiBaseUrl?.includes("openrouter.ai")) {
    return "openrouter";
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  return "gateway";
}

function withJsonExtraction(model: LanguageModelV3): LanguageModelV3 {
  return wrapLanguageModel({
    model,
    middleware: extractJsonMiddleware(),
  });
}
