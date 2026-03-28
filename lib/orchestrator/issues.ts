import { slugify } from "@/lib/planner/brief";
import type { AppSpec, IssuePlan } from "@/lib/planner/schemas";

export function createIssueBacklog(spec: AppSpec): IssuePlan[] {
  return [
    {
      id: `${slugify(spec.appName)}-full-build-1`,
      title: `Build complete ${spec.appName} site`,
      summary: `Implement the full ${spec.appName} site end-to-end: page structure, navigation, hero, feature sections, all interactions, styling, responsive design, content, and deployment readiness. Focus on ${spec.issueInputs.primaryGoal.toLowerCase()}.`,
      githubIssueNumber: null,
      allowedFiles: allowedFilesForStarter(spec.starterKind),
      acceptanceCriteria: [
        `Page structure with ${spec.pages.join(", ")} navigation in a static-friendly shell.`,
        `Hero section reflecting "${spec.issueInputs.primaryGoal}" with primary CTA above the fold.`,
        `All sections implemented: ${spec.sections.join(", ")}.`,
        `Interactive behaviors: ${spec.issueInputs.interactions.join(", ")}.`,
        `Responsive layout from mobile to desktop with touch-friendly controls.`,
        `Polished typography, spacing, hover states, and visual style for ${spec.issueInputs.audience.join(", ")}.`,
        `Copy feels tailored and production-ready, not placeholder wireframe text.`,
        `GitHub Pages compatible — static export, metadata, lint and tests pass.`,
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

function allowedFilesForStarter(starterKind: AppSpec["starterKind"]): string[] {
  const common = [
    "index.html",
    "styles.css",
    "script.js",
    ".nojekyll",
    ".github/workflows/ci.yml",
    ".github/workflows/deploy-pages.yml",
    ".github/workflows/claude.yml",
    "CLAUDE.md",
  ];

  if (starterKind === "dashboard") {
    return [...common, "assets/metrics.json"];
  }

  if (starterKind === "content") {
    return [...common, "assets/articles.json"];
  }

  return common;
}
