import { slugify } from "@/lib/planner/brief";
import { pageToFilename } from "@/lib/orchestrator/templates";
import type { AppSpec, IssuePlan } from "@/lib/planner/schemas";

type AgentProvider = "copilot" | "claude" | "glm";

/**
 * Creates one issue per page so each page can be built in parallel by
 * separate agent runs.  Falls back to a single issue when fewer than 2
 * pages are defined.
 */
export function createIssueBacklog(spec: AppSpec, agentProvider: AgentProvider): IssuePlan[] {
  const userDesc = spec.briefContext?.userDescription || "";
  const goalText = spec.issueInputs.primaryGoal.toLowerCase();

  const sharedContext = [
    userDesc ? `\nUser request:\n${userDesc}` : "",
    `\nCore objective: ${goalText}.`,
    spec.briefContext?.mainProblem
      ? `\nProblem being solved: ${spec.briefContext.mainProblem}`
      : "",
    spec.briefContext?.targetUsers?.length
      ? `\nTarget audience: ${spec.briefContext.targetUsers.join(", ")}`
      : "",
    spec.briefContext?.visualStyleDirection?.length
      ? `\nVisual style: ${spec.briefContext.visualStyleDirection.join(", ")}`
      : "",
  ].filter(Boolean).join("");

  const allPageFiles = spec.pages.map((p) => pageToFilename(p));
  const navNote = `Navigation must link to all pages: ${allPageFiles.join(", ")}.`;

  // Distribute sections across pages (round-robin when sections > pages).
  const pageSections: string[][] = spec.pages.map(() => []);
  spec.sections.forEach((section, idx) => {
    pageSections[idx % spec.pages.length].push(section);
  });

  const issues: IssuePlan[] = spec.pages.map((page, idx) => {
    const filename = pageToFilename(page);
    const isHome = idx === 0;
    const sectionsForPage = pageSections[idx];

    const summary = [
      `Implement the "${page}" page (${filename}) for ${spec.appName}.`,
      sharedContext,
      sectionsForPage.length
        ? `\nSections on this page: ${sectionsForPage.join(", ")}.`
        : "",
      `\n${navNote}`,
      isHome
        ? `\nThis is the home page — include a hero section reflecting "${spec.issueInputs.primaryGoal}" with a primary CTA above the fold.`
        : "",
    ].filter(Boolean).join("");

    const acceptanceCriteria = [
      `Page ${filename} is fully implemented with real content (not placeholder text).`,
      `Page links to styles.css and script.js, has primary-nav with links to all other pages.`,
      ...(isHome
        ? [`Hero section with primary CTA above the fold.`]
        : []),
      ...(sectionsForPage.length
        ? [`Sections implemented: ${sectionsForPage.join(", ")}.`]
        : []),
      `Responsive layout from mobile to desktop with touch-friendly controls.`,
      `Polished typography, spacing, hover states, and visual style for ${spec.issueInputs.audience.join(", ")}.`,
      `GitHub Pages compatible — lint and tests pass.`,
    ];

    const domTargets = [
      "site-shell",
      "primary-nav",
      ...(isHome ? ["hero-section", "primary-cta"] : []),
      ...(sectionsForPage.length ? ["feature-grid"] : []),
      "footer-section",
    ];

    return {
      id: `${slugify(spec.appName)}-page-${idx + 1}`,
      title: `Build "${page}" page for ${spec.appName}`,
      summary,
      githubIssueNumber: null,
      allowedFiles: [
        filename,
        // Only the first page (home) owns shared assets to avoid merge
        // conflicts when agents run in parallel.
        ...(isHome
          ? ["styles.css", "script.js", ...agentSupportFiles(agentProvider)]
          : []),
      ],
      acceptanceCriteria,
      expectedDomTargets: domTargets,
      ciChecks: ["npm run lint", "npm test"],
      status: "pending" as const,
    };
  });

  return issues;
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
