import { generateObject, generateText, jsonSchema } from "ai";
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

    const prompt = buildMarkdownPrompt({
      brief: body.brief,
      messages: trimPromptMessages(body.messages),
    });

    try {
      const result = await generateObject({
        model: getPlannerModel(),
        system: MARKDOWN_SYSTEM_PROMPT,
        prompt,
        schema: jsonSchema<z.infer<typeof generatedArtifactModelSchema>>(
          {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              markdown: { type: "string" },
              userMarkdown: { type: "string" },
            },
            required: ["title", "markdown", "userMarkdown"],
          },
          {
            validate: async (value) => {
              const parsed = await generatedArtifactModelSchema.safeParseAsync(value);

              return parsed.success
                ? { success: true, value: parsed.data }
                : { success: false, error: parsed.error };
            },
          },
        ),
        schemaName: "generatedArtifact",
        schemaDescription:
          "The final markdown handoff artifact with a polished title and raw markdown body.",
        temperature: 0.45,
        maxRetries: 2,
        maxOutputTokens: 8000,
      });

      return Response.json(result.object);
    } catch (error) {
      if (!shouldUsePlainTextFallback(error)) {
        throw error;
      }

      const fallback = await generateText({
        model: getPlannerModel({ jsonExtraction: false }),
        system: `${MARKDOWN_SYSTEM_PROMPT}

Fallback output mode:
- Do not return JSON.
- Do not wrap the whole response in markdown fences.
- Return these exact section markers on their own lines:
[[[TITLE]]]
<single-line title>
[[[AGENT_MARKDOWN]]]
<full agent markdown document>
[[[USER_MARKDOWN]]]
<full user markdown document>`,
        prompt,
        temperature: 0.45,
        maxRetries: 1,
        maxOutputTokens: 8000,
      });

      return Response.json(parsePlainTextArtifact(fallback.text));
    }
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

function shouldUsePlainTextFallback(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("json_validate_failed") ||
      error.message.includes("Failed to generate JSON"))
  );
}

function parsePlainTextArtifact(text: string) {
  const title = extractSection(text, "TITLE");
  const markdown = extractSection(text, "AGENT_MARKDOWN");
  const userMarkdown = extractSection(text, "USER_MARKDOWN");

  return generatedArtifactModelSchema.parse({
    title: title.split("\n")[0]?.trim() || "Untitled app concept",
    markdown,
    userMarkdown,
  });
}

function extractSection(text: string, name: "TITLE" | "AGENT_MARKDOWN" | "USER_MARKDOWN"): string {
  const marker = `[[[${name}]]]`;
  const start = text.indexOf(marker);

  if (start === -1) {
    throw new Error(`Fallback output is missing the ${name} section.`);
  }

  const contentStart = start + marker.length;
  const nextMarkerIndex = text.indexOf("[[[", contentStart);
  const section =
    nextMarkerIndex === -1
      ? text.slice(contentStart)
      : text.slice(contentStart, nextMarkerIndex);

  return section.trim();
}
