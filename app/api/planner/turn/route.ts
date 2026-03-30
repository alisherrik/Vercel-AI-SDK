import { generateText } from "ai";
import { z } from "zod";

import { getPlannerModel } from "@/lib/ai-model";
import {
  createReadyToGenerateMessage,
  getMissingFields,
  mergeProjectBrief,
  shouldGenerateNow,
  trimPromptMessages,
  withSuggestionIds,
} from "@/lib/planner/brief";
import { buildPlannerTurnPrompt, PLANNER_SYSTEM_PROMPT } from "@/lib/planner/prompts";
import {
  discoveryFieldSchema,
  plannerTurnModelSchema,
  plannerTurnRequestSchema,
  plannerTurnSchema,
  projectBriefDeltaSchema,
} from "@/lib/planner/schemas";
import { getReadableRouteError } from "@/lib/route-error";
import { extractUrls, formatScrapedPages, scrapeUrls } from "@/lib/url-scraper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = plannerTurnRequestSchema.parse(await request.json());

    // Detect and scrape any URLs in the user's answer
    const urls = extractUrls(body.latestAnswer);
    const scrapedPages = urls.length > 0 ? await scrapeUrls(urls) : [];
    const scrapedContext = formatScrapedPages(scrapedPages);

    const result = await generateText({
      model: getPlannerModel(),
      system: PLANNER_SYSTEM_PROMPT,
      prompt: buildPlannerTurnPrompt({
        brief: body.brief,
        latestAnswer: body.latestAnswer,
        messages: trimPromptMessages(body.messages),
        questionCount: body.questionCount,
        maxQuestions: body.maxQuestions,
        scrapedContext,
      }),
      temperature: 0.5,
      maxRetries: 2,
    });

    const rawParsed = parsePlannerTurnPayload(result.text) as {
      message?: unknown;
      suggestions?: unknown;
      briefDelta?: unknown;
      missingFields?: unknown;
      readyToGenerate?: unknown;
    };

    const parsed = normalizePlannerTurn(rawParsed, result.text);

    const mergedBrief = mergeProjectBrief(body.brief, parsed.briefDelta);
    const missingFields = getMissingFields(mergedBrief);
    const readyToGenerate =
      parsed.readyToGenerate ||
      shouldGenerateNow(body.questionCount, missingFields, body.maxQuestions);

    const turn = plannerTurnSchema.parse({
      message: readyToGenerate
        ? parsed.readyToGenerate
          ? parsed.message
          : createReadyToGenerateMessage(mergedBrief.language)
        : parsed.message,
      suggestions: withSuggestionIds(parsed.suggestions),
      briefDelta: parsed.briefDelta,
      missingFields,
      readyToGenerate,
    });

    return Response.json(turn);
  } catch (error) {
    console.error("[planner-turn]", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "The planner request or response shape was invalid." },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error: getReadableRouteError(error),
      },
      { status: 500 },
    );
  }
}

function parsePlannerTurnPayload(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
      } catch {
        return {};
      }
    }

    return {};
  }
}

function normalizePlannerTurn(
  rawParsed: {
    message?: unknown;
    suggestions?: unknown;
    briefDelta?: unknown;
    missingFields?: unknown;
    readyToGenerate?: unknown;
  },
  rawText: string,
) {
  const briefDeltaResult = projectBriefDeltaSchema.safeParse(rawParsed.briefDelta);
  const missingFieldsResult = z.array(discoveryFieldSchema).safeParse(rawParsed.missingFields);
  const message =
    typeof rawParsed.message === "string" && rawParsed.message.trim()
      ? rawParsed.message.trim().slice(0, 500)
      : extractFallbackMessage(rawText);

  return plannerTurnModelSchema.parse({
    message,
    suggestions: normalizeSuggestions(rawParsed.suggestions),
    briefDelta: briefDeltaResult.success ? briefDeltaResult.data : {},
    missingFields: missingFieldsResult.success ? missingFieldsResult.data : [],
    readyToGenerate: rawParsed.readyToGenerate === true,
  });
}

function extractFallbackMessage(rawText: string): string {
  const compact = rawText.trim().replace(/\s+/g, " ");
  return compact
    ? compact.slice(0, 500)
    : "I understood the direction. Let me tighten the scope with one more detail.";
}

function normalizeSuggestions(input: unknown) {
  const parsedSuggestions = z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        value: z.string().trim().min(1).max(240),
      }),
    )
    .safeParse(input);

  const suggestions = parsedSuggestions.success ? parsedSuggestions.data : [];
  const deduped = suggestions.filter(
    (suggestion, index, items) =>
      items.findIndex((item) => item.label === suggestion.label) === index,
  );

  const fallbacks = [
    {
      label: "Show example",
      value: "Show me a concrete example so I can answer faster.",
    },
    {
      label: "I prefer simple",
      value: "Keep it simple for day one and use the most practical default.",
    },
    {
      label: "Ask in Uzbek",
      value: "Please continue in Uzbek and keep the options short.",
    },
  ];

  return [...deduped, ...fallbacks].slice(0, 3);
}
