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
  plannerTurnModelSchema,
  plannerTurnRequestSchema,
  plannerTurnSchema,
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

    const parsed = plannerTurnModelSchema.parse(JSON.parse(result.text));

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
