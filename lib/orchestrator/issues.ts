import { slugify } from "@/lib/planner/brief";
import type { AppSpec, IssuePlan } from "@/lib/planner/schemas";

type AgentProvider = "copilot" | "claude" | "glm";

export function createIssueBacklog(spec: AppSpec, agentProvider: AgentProvider): IssuePlan[] {
  return [
    {
      id: `${slugify(spec.appName)}-full-build-1`,
      title: `Build complete ${spec.appName} site`,
      summary: `Implement the full ${spec.appName} site end-to-end: page structure, navigation, hero, feature sections, all interactions, styling, responsive design, content, and deployment readiness. Focus on ${spec.issueInputs.primaryGoal.toLowerCase()}.`,
      githubIssueNumber: null,
      allowedFiles: allowedFilesForStarter(spec.starterKind, agentProvider),
      acceptanceCriteria: [
        `Page structure with ${spec.pages.join(", ")} navigation in an interactive client-side shell.`,
        `Hero section reflecting "${spec.issueInputs.primaryGoal}" with primary CTA above the fold.`,
        `All sections implemented: ${spec.sections.join(", ")}.`,
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
  starterKind: AppSpec["starterKind"],
  agentProvider: AgentProvider,
): string[] {
  const common = [
    "index.html",
    "styles.css",
    "script.js",
    ".nojekyll",
    ".github/workflows/ci.yml",
    ".github/workflows/deploy-pages.yml",
    ...agentSupportFiles(agentProvider),
  ];

  if (starterKind === "dashboard") {
    return [...common, "assets/metrics.json"];
  }

  if (starterKind === "content") {
    return [...common, "assets/articles.json"];
  }

  return common;
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
