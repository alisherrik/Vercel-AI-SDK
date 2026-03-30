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
const FALLBACK_MARKDOWN_SYSTEM_PROMPT = `
You write concise, premium product handoff documents for vibe-coding tools.

Produce three sections in this exact plain-text format:
TITLE: <short polished app title>
<<<AGENT_MARKDOWN>>>
<technical implementation markdown for the AI coding agent>
<<<USER_MARKDOWN>>>
<polished user-facing product overview markdown>

Rules:
- Do not return JSON.
- Do not add explanations before or after the sections.
- Keep the TITLE on one line.
- The AGENT_MARKDOWN should be detailed and implementation-ready.
- The USER_MARKDOWN should be clear, exciting, and easy for a founder to read.
`.trim();

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
        system: FALLBACK_MARKDOWN_SYSTEM_PROMPT,
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
  const markdown =
    extractSection(text, "AGENT_MARKDOWN") ||
    extractJsonLikeValue(text, "markdown") ||
    text.trim();
  const userMarkdown =
    extractSection(text, "USER_MARKDOWN") ||
    extractJsonLikeValue(text, "userMarkdown") ||
    markdown;
  const title =
    extractSection(text, "TITLE") ||
    extractTitleLine(text) ||
    extractJsonLikeValue(text, "title") ||
    "Untitled app concept";

  return generatedArtifactModelSchema.parse({
    title: title.split("\n")[0]?.trim() || "Untitled app concept",
    markdown,
    userMarkdown,
  });
}

function extractSection(text: string, name: "TITLE" | "AGENT_MARKDOWN" | "USER_MARKDOWN"): string {
  const markers =
    name === "TITLE"
      ? [`[[[${name}]]]`, "TITLE:"]
      : [`[[[${name}]]]`, `<<<${name}>>>`];

  for (const marker of markers) {
    const start = text.indexOf(marker);

    if (start === -1) {
      continue;
    }

    const contentStart = start + marker.length;
    const nextMarkerIndex = findNextMarkerIndex(text, contentStart);
    const section =
      nextMarkerIndex === -1
        ? text.slice(contentStart)
        : text.slice(contentStart, nextMarkerIndex);

    const trimmed = section.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function findNextMarkerIndex(text: string, fromIndex: number): number {
  const candidates = [
    text.indexOf("[[[", fromIndex),
    text.indexOf("<<<", fromIndex),
    text.indexOf("\nTITLE:", fromIndex),
  ].filter((index) => index !== -1);

  return candidates.length ? Math.min(...candidates) : -1;
}

function extractTitleLine(text: string): string {
  const headingMatch = text.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  const titleMatch = text.match(/^TITLE:\s*(.+)$/m);
  return titleMatch?.[1]?.trim() || "";
}

function extractJsonLikeValue(
  text: string,
  key: "title" | "markdown" | "userMarkdown",
): string {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s"));

  if (!match?.[1]) {
    return "";
  }

  try {
    return JSON.parse(`"${match[1]}"`).trim();
  } catch {
    return match[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
  }
}
