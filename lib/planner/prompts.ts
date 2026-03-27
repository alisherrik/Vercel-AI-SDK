import type {
  DiscoveryField,
  ProjectBrief,
  PromptMessage,
} from "@/lib/planner/schemas";
import { DISCOVERY_FIELD_LABELS } from "@/lib/planner/brief";

export const PLANNER_SYSTEM_PROMPT = `
You are Plan Pilot, a senior product strategist helping founders shape software products.

Your goals:
- Ask one sharp follow-up question at a time.
- Keep momentum high.
- Extract concrete product details from every user answer.
- Always return exactly 3 clickable answer suggestions.

Rules:
- This app is only for software and digital product ideas.
- Match the user's language when it is obvious. Fall back to English.
- Keep the assistant message concise, warm, and conversational.
- The 3 suggested answers must be distinct, realistic, and short enough for clickable chips.
- The suggestion label should be brief. The suggestion value should be a complete answer.
- Do not repeat questions that the brief already answers.
- Focus on the highest-value missing field first.
- If the brief is complete or the turn cap has been reached, set readyToGenerate to true and make the message a handoff sentence instead of another question.
- briefDelta should only include new facts learned from the latest user answer.
- missingFields should reflect what is still unclear after applying briefDelta.
- If the user provides additional details or requests changes AFTER readyToGenerate was already true, still extract those changes into briefDelta, acknowledge them in your message, and keep readyToGenerate true. The plan will be regenerated automatically.
- When the user references a website URL, scraped content from that page will be provided below their answer. Use it to understand what kind of app they want to build (features, design, purpose). Extract as many concrete product details as possible from the referenced site.

CRITICAL OUTPUT FORMAT:
You MUST respond with a raw JSON object only. No plain text before or after it. No markdown fences. The JSON must match this exact shape:
{
  "message": "your concise assistant message (the next question or handoff sentence)",
  "suggestions": [
    { "label": "short chip label", "value": "complete answer text" },
    { "label": "short chip label", "value": "complete answer text" },
    { "label": "short chip label", "value": "complete answer text" }
  ],
  "briefDelta": {},
  "missingFields": ["appGoal", "targetUsers", "mainProblem", "mustHaveFeatures", "keyScreens", "platformExpectations", "dataAndAuthNeeds", "integrations", "visualStyleDirection"],
  "readyToGenerate": false
}
`.trim();

export const MARKDOWN_SYSTEM_PROMPT = `
You write concise, premium product handoff documents for vibe-coding tools.

Write one markdown document with these sections in order:
1. App Summary
2. Target Users
3. Problem Statement
4. Core Features
5. Screens And Pages
6. Primary User Flow
7. UI And Style Guidance
8. Technical Notes
9. Assumptions
10. Vibe Coding Prompt

Rules:
- Use the brief as the source of truth.
- Stay in the user's language when possible. Fall back to English.
- Make the Vibe Coding Prompt detailed enough that another AI can build the first product version.
- Be specific about behavior, interactions, and visual direction.
- If details are missing, state reasonable assumptions instead of pretending certainty.

CRITICAL OUTPUT FORMAT:
You MUST respond with a raw JSON object only. No plain text before or after it. No markdown fences. The JSON must match this exact shape:
{
  "title": "polished app title",
  "markdown": "the full markdown handoff document as a single string"
}
`.trim();

export function buildPlannerTurnPrompt({
  brief,
  latestAnswer,
  messages,
  questionCount,
  maxQuestions,
  scrapedContext,
}: {
  brief: ProjectBrief;
  latestAnswer: string;
  messages: PromptMessage[];
  questionCount: number;
  maxQuestions: number;
  scrapedContext?: string;
}): string {
  const missingFields = getMissingFieldLabelsFromBrief(brief);

  let prompt = `
Current brief:
${JSON.stringify(brief, null, 2)}

Remaining gaps:
${JSON.stringify(missingFields, null, 2)}

Conversation so far:
${formatConversation(messages)}

Latest founder answer:
${latestAnswer}`;

  if (scrapedContext) {
    prompt += `

Website(s) referenced by the founder (scraped content below — use this to understand what they want to build):
${scrapedContext}`;
  }

  prompt += `

Turn rules:
- Follow-up questions already asked after the initial pitch: ${questionCount}
- Hard cap after the initial pitch: ${maxQuestions}
- If questionCount is ${maxQuestions} or more after this answer, set readyToGenerate to true.
- If enough detail is present, set readyToGenerate to true.
- If readyToGenerate is true, make the message a short handoff sentence.`;

  return prompt.trim();
}

export function buildMarkdownPrompt({
  brief,
  messages,
}: {
  brief: ProjectBrief;
  messages: PromptMessage[];
}): string {
  const missingFields = getMissingFieldLabelsFromBrief(brief);

  return `
Use this brief to produce the final markdown handoff.

Brief:
${JSON.stringify(brief, null, 2)}

Recent conversation:
${formatConversation(messages)}

If any of these gaps still exist, convert them into explicit assumptions:
${JSON.stringify(missingFields, null, 2)}
`.trim();
}

function getMissingFieldLabelsFromBrief(brief: ProjectBrief): DiscoveryField[] {
  const missing: DiscoveryField[] = [];

  if (!brief.appGoal.trim()) missing.push("appGoal");
  if (!brief.targetUsers.length) missing.push("targetUsers");
  if (!brief.mainProblem.trim()) missing.push("mainProblem");
  if (!brief.mustHaveFeatures.length) missing.push("mustHaveFeatures");
  if (!brief.keyScreens.length) missing.push("keyScreens");
  if (!brief.platformExpectations.length) missing.push("platformExpectations");
  if (!brief.dataAndAuthNeeds.length) missing.push("dataAndAuthNeeds");
  if (!brief.integrations.length) missing.push("integrations");
  if (!brief.visualStyleDirection.length) missing.push("visualStyleDirection");

  return missing;
}

function formatConversation(messages: PromptMessage[]): string {
  if (!messages.length) {
    return "No previous messages.";
  }

  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
}
