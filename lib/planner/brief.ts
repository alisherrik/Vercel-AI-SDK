import type {
  ChatMessage,
  DiscoveryField,
  PlannerSession,
  ProjectBrief,
  ProjectBriefDelta,
  PromptMessage,
  SuggestedAnswer,
} from "@/lib/planner/schemas";

export const STORAGE_KEY = "plan-generation-chat/v1";
export const MAX_PLANNER_QUESTIONS = 6;

export const DISCOVERY_FIELD_LABELS: Record<DiscoveryField, string> = {
  appGoal: "App goal",
  targetUsers: "Target users",
  mainProblem: "Main problem",
  mustHaveFeatures: "Must-have features",
  keyScreens: "Key screens",
  platformExpectations: "Platform expectations",
  dataAndAuthNeeds: "Data and auth",
  integrations: "Integrations",
  visualStyleDirection: "Visual style",
};

export const INITIAL_SUGGESTIONS: SuggestedAnswer[] = [
  {
    id: "new-saas",
    label: "B2B SaaS",
    value: "I want to build a B2B SaaS app for teams that need a better workflow.",
  },
  {
    id: "internal-tool",
    label: "Internal tool",
    value:
      "I want to build an internal tool that helps my team automate operations and save time.",
  },
  {
    id: "consumer-app",
    label: "Consumer app",
    value:
      "I want to build a consumer-facing app with a clear everyday problem to solve.",
  },
];

const emptyBrief: ProjectBrief = {
  title: "",
  language: "English",
  appGoal: "",
  targetUsers: [],
  mainProblem: "",
  mustHaveFeatures: [],
  keyScreens: [],
  platformExpectations: [],
  dataAndAuthNeeds: [],
  integrations: [],
  visualStyleDirection: [],
  technicalNotes: [],
  assumptions: [],
};

export function createEmptyBrief(): ProjectBrief {
  return {
    ...emptyBrief,
    targetUsers: [],
    mustHaveFeatures: [],
    keyScreens: [],
    platformExpectations: [],
    dataAndAuthNeeds: [],
    integrations: [],
    visualStyleDirection: [],
    technicalNotes: [],
    assumptions: [],
  };
}

export function createChatMessage(
  role: ChatMessage["role"],
  content: string,
  suggestions?: SuggestedAnswer[],
): ChatMessage {
  return {
    id: createId("msg"),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...(suggestions ? { suggestions } : {}),
  };
}

export function createInitialSession(): PlannerSession {
  return {
    brief: createEmptyBrief(),
    artifact: null,
    questionCount: 0,
    messages: [
      createChatMessage(
        "assistant",
        "Tell me what kind of software app you want to build. I will interview you, shape the idea, and turn it into a markdown handoff for a vibe-coding tool.",
        INITIAL_SUGGESTIONS,
      ),
    ],
  };
}

export function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) {
    return `${prefix}-${random}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mergeProjectBrief(
  currentBrief: ProjectBrief,
  delta: ProjectBriefDelta,
): ProjectBrief {
  return {
    title: mergeText(currentBrief.title, delta.title),
    language: mergeText(currentBrief.language, delta.language) || "English",
    appGoal: mergeText(currentBrief.appGoal, delta.appGoal),
    targetUsers: mergeList(currentBrief.targetUsers, delta.targetUsers),
    mainProblem: mergeText(currentBrief.mainProblem, delta.mainProblem),
    mustHaveFeatures: mergeList(
      currentBrief.mustHaveFeatures,
      delta.mustHaveFeatures,
    ),
    keyScreens: mergeList(currentBrief.keyScreens, delta.keyScreens),
    platformExpectations: mergeList(
      currentBrief.platformExpectations,
      delta.platformExpectations,
    ),
    dataAndAuthNeeds: mergeList(
      currentBrief.dataAndAuthNeeds,
      delta.dataAndAuthNeeds,
    ),
    integrations: mergeList(currentBrief.integrations, delta.integrations),
    visualStyleDirection: mergeList(
      currentBrief.visualStyleDirection,
      delta.visualStyleDirection,
    ),
    technicalNotes: mergeList(currentBrief.technicalNotes, delta.technicalNotes),
    assumptions: mergeList(currentBrief.assumptions, delta.assumptions),
  };
}

export function getMissingFields(brief: ProjectBrief): DiscoveryField[] {
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

export function shouldGenerateNow(
  questionCount: number,
  missingFields: DiscoveryField[],
  maxQuestions = MAX_PLANNER_QUESTIONS,
): boolean {
  return questionCount >= maxQuestions || missingFields.length === 0;
}

export function getCapturedFieldCount(brief: ProjectBrief): number {
  return Object.keys(DISCOVERY_FIELD_LABELS).length - getMissingFields(brief).length;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "app-plan";
}

export function createFileName(title: string): string {
  return `${slugify(title)}-plan.md`;
}

export function trimPromptMessages(
  messages: PromptMessage[],
  maxMessages = 12,
): PromptMessage[] {
  return messages.slice(-maxMessages);
}

export function withSuggestionIds(
  suggestions: Array<Omit<SuggestedAnswer, "id">>,
): SuggestedAnswer[] {
  return suggestions.map((suggestion, index) => ({
    ...suggestion,
    id: `${slugify(suggestion.label)}-${index + 1}`,
  }));
}

export function createReadyToGenerateMessage(language: string): string {
  if (language.toLowerCase().includes("russian")) {
    return "Мне уже хватает деталей. Я собираю финальный markdown-план для сборки приложения.";
  }

  return "I have enough detail now. I am turning this into the final markdown handoff.";
}

export function toPromptMessages(messages: ChatMessage[]): PromptMessage[] {
  return messages.map(({ content, role }) => ({ content, role }));
}

function mergeText(currentValue: string, incomingValue?: string): string {
  const normalizedIncoming = incomingValue?.trim();
  if (!normalizedIncoming) {
    return currentValue;
  }

  return normalizedIncoming;
}

function mergeList(currentList: string[], incomingList?: string[]): string[] {
  const items = [...currentList];
  const seen = new Set(items.map(normalizeListItem));

  for (const item of incomingList ?? []) {
    const normalizedItem = item.trim();
    const seenKey = normalizeListItem(normalizedItem);

    if (!normalizedItem || seen.has(seenKey)) {
      continue;
    }

    items.push(normalizedItem);
    seen.add(seenKey);
  }

  return items;
}

function normalizeListItem(value: string): string {
  return value.trim().toLowerCase();
}
