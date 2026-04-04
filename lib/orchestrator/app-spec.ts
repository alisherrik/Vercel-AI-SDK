import type {
  AppSpec,
  ProjectBrief,
  PromptMessage,
  StarterKind,
} from "@/lib/planner/schemas";

const THEME_PRESETS = {
  landing: {
    headline: "Editorial warmth for decisive launches",
    background: "#f4efe7",
    surface: "#fffaf4",
    accent: "#bc5e2c",
    text: "#1c1917",
  },
  dashboard: {
    headline: "Operational clarity with sharp contrast",
    background: "#f3f6fb",
    surface: "#ffffff",
    accent: "#2563eb",
    text: "#0f172a",
  },
  content: {
    headline: "Calm publishing with magazine polish",
    background: "#f7f4ee",
    surface: "#fffdf9",
    accent: "#0f766e",
    text: "#172554",
  },
} as const;

export function createAppSpec(
  brief: ProjectBrief,
  messages: PromptMessage[],
): AppSpec {
  const userDescription = brief.description?.trim() || "";
  const starterKind = inferStarterKind(brief);
  const appName =
    brief.title.trim() ||
    brief.appGoal.split(" ").slice(0, 3).join(" ") ||
    "Production Pilot";
  const pages = uniqueList([
    "Home",
    ...brief.keyScreens,
    ...(starterKind === "dashboard" ? ["Metrics"] : []),
    ...(starterKind === "content" ? ["Library"] : []),
  ]);
  const sections = uniqueList([
    "Hero",
    ...brief.mustHaveFeatures,
    ...(brief.targetUsers.length ? ["Who it is for"] : []),
    ...(brief.integrations.length ? ["Integrations"] : []),
    "Primary call to action",
  ]);
  const features = uniqueList([
    ...brief.mustHaveFeatures,
    ...brief.keyScreens,
    ...brief.integrations,
    "Responsive layout",
  ]);
  const interactions = uniqueList([
    "Primary CTA flow",
    ...(brief.keyScreens.length ? brief.keyScreens.map((screen) => `${screen} interactions`) : []),
    "Mobile navigation",
  ]);
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  const effectiveGoal =
    brief.appGoal ||
    userDescription ||
    "Turn the product brief into an interactive production-ready web experience";

  return {
    appName,
    starterKind,
    pages: fallbackList(pages, ["Home"]),
    sections: fallbackList(sections, ["Hero", "Primary call to action"]),
    theme: THEME_PRESETS[starterKind],
    copyTone:
      brief.visualStyleDirection[0] ||
      (lastUserMessage ? "Tailored and concrete" : "Clear, premium, and grounded"),
    features: fallbackList(features, ["Responsive layout"]),
    assetsNeeded: uniqueList([
      "Wordmark",
      ...(starterKind === "landing" ? ["Customer logos"] : []),
      ...(starterKind === "dashboard" ? ["Metric cards"] : []),
      ...(starterKind === "content" ? ["Article thumbnails"] : []),
    ]),
    githubPagesConstraints: [
      "No server runtime",
      "Interactive client-side HTML, CSS, and JavaScript only",
      "Relative asset paths only",
      "Deploy via GitHub Pages workflow",
    ],
    issueInputs: {
      primaryGoal: effectiveGoal,
      audience: fallbackList(brief.targetUsers, ["Internal stakeholders"]),
      coreScreens: fallbackList(brief.keyScreens, ["Home"]),
      interactions: fallbackList(interactions, ["Primary CTA flow"]),
    },
    briefContext: {
      userDescription,
      mainProblem: brief.mainProblem || "",
      dataAndAuthNeeds: brief.dataAndAuthNeeds,
      integrations: brief.integrations,
      visualStyleDirection: brief.visualStyleDirection,
      targetUsers: brief.targetUsers,
      platformExpectations: brief.platformExpectations,
    },
  };
}

export function inferStarterKind(brief: ProjectBrief): StarterKind {
  const text = [
    brief.appGoal,
    brief.description,
    brief.mainProblem,
    ...brief.mustHaveFeatures,
    ...brief.keyScreens,
    ...brief.platformExpectations,
  ]
    .join(" ")
    .toLowerCase();

  if (/(dashboard|admin|analytics|metrics|internal|ops|crm|panel|monitor|report|manage|tracking|inventory|saas)/.test(text)) {
    return "dashboard";
  }

  if (/(blog|content|library|magazine|media|article|knowledge|news|publish|wiki|documentation|learning|course|podcast)/.test(text)) {
    return "content";
  }

  return "landing";
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();

  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;

      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function fallbackList(values: string[], fallback: string[]): string[] {
  return values.length ? values.slice(0, 8) : fallback;
}
