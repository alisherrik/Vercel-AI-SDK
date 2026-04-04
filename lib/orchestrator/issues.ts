import { slugify } from "@/lib/planner/brief";
import { pageToFilename } from "@/lib/orchestrator/templates";
import type { AppSpec, IssuePlan } from "@/lib/planner/schemas";

type AgentProvider = "copilot" | "claude" | "glm";

export function createIssueBacklog(spec: AppSpec, agentProvider: AgentProvider): IssuePlan[] {
  const userDesc = spec.briefContext?.userDescription || "";
  const goalText = spec.issueInputs.primaryGoal.toLowerCase();
  const summaryParts = [
    `Implement the full ${spec.appName} site end-to-end.`,
    userDesc
      ? `\n\nUser request:\n${userDesc}`
      : "",
    `\n\nCore objective: ${goalText}.`,
    `\nDeliver page structure, navigation, hero, feature sections, all interactions, styling, responsive design, real content, and deployment readiness.`,
    spec.briefContext?.mainProblem
      ? `\nProblem being solved: ${spec.briefContext.mainProblem}`
      : "",
    spec.briefContext?.targetUsers?.length
      ? `\nTarget audience: ${spec.briefContext.targetUsers.join(", ")}`
      : "",
    spec.briefContext?.visualStyleDirection?.length
      ? `\nVisual style: ${spec.briefContext.visualStyleDirection.join(", ")}`
      : "",
  ];

  return [
    {
      id: `${slugify(spec.appName)}-full-build-1`,
      title: `Build complete ${spec.appName} site`,
      summary: summaryParts.filter(Boolean).join(""),
      githubIssueNumber: null,
      allowedFiles: allowedFilesForStarter(spec, agentProvider),
      acceptanceCriteria: [
        `Multi-page site with ${spec.pages.length} pages: ${spec.pages.map((p) => `${p} (${pageToFilename(p)})`).join(", ")}.`,
        `Every page links to styles.css and script.js, has primary-nav with links to all other pages.`,
        `Home page hero section reflecting "${spec.issueInputs.primaryGoal}" with primary CTA above the fold.`,
        `All sections implemented across pages: ${spec.sections.join(", ")}.`,
        `Interactive behaviors: ${spec.issueInputs.interactions.join(", ")}.`,
        `Responsive layout from mobile to desktop with touch-friendly controls.`,
        `Polished typography, spacing, hover states, and visual style for ${spec.issueInputs.audience.join(", ")}.`,
        `Copy feels tailored and production-ready, not placeholder wireframe text.`,
        `GitHub Pages compatible — interactive client-side pages, metadata, lint and tests pass.`,
      ],
      expectedDomTargets: [
        "site-shell",
        "primary-nav",
        "hero-section",
        "feature-grid",
        "primary-cta",
        "mobile-nav-toggle",
        "interactive-demo",
        "footer-section",
      ],
      ciChecks: ["npm run lint", "npm test"],
      status: "pending",
    },
  ];
}

function allowedFilesForStarter(
  spec: AppSpec,
  agentProvider: AgentProvider,
): string[] {
  const pageFiles = spec.pages.map((p) => pageToFilename(p));
  return [
    ...pageFiles,
    "styles.css",
    "script.js",
    ".nojekyll",
    ".github/workflows/ci.yml",
    ".github/workflows/deploy-pages.yml",
    ...agentSupportFiles(agentProvider),
  ];
}

function agentSupportFiles(agentProvider: AgentProvider): string[] {
  if (agentProvider === "copilot") {
    return [];
  }

  if (agentProvider === "glm") {
    return [
      ".github/workflows/agent.yml",
      ".github/scripts/implement-with-glm.mjs",
      "AGENT.md",
    ];
  }

  return [".github/workflows/agent.yml", "AGENT.md"];
}
