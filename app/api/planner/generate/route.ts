import { streamObject } from "ai";
import { z } from "zod";

import { getPlannerModel } from "@/lib/ai-model";
import { trimPromptMessages } from "@/lib/planner/brief";
import { buildMarkdownPrompt, MARKDOWN_SYSTEM_PROMPT } from "@/lib/planner/prompts";
import {
  generatedArtifactModelSchema,
  plannerGenerateRequestSchema,
} from "@/lib/planner/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = plannerGenerateRequestSchema.parse(await request.json());

    const result = streamObject({
      model: getPlannerModel(),
      system: MARKDOWN_SYSTEM_PROMPT,
      prompt: buildMarkdownPrompt({
        brief: body.brief,
        messages: trimPromptMessages(body.messages),
      }),
      schema: generatedArtifactModelSchema,
      schemaName: "generatedArtifact",
      schemaDescription:
        "The final markdown handoff artifact with a polished title and raw markdown body.",
      temperature: 0.45,
      maxRetries: 2,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[planner-generate]", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "The planner request or response shape was invalid." },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
