import { describe, expect, it } from "vitest";

import { renderStarterApp } from "@/lib/orchestrator/templates";
import type { AppSpec } from "@/lib/planner/schemas";

const spec: AppSpec = {
  appName: "Robust Build",
  starterKind: "landing",
  pages: ["Home", "Features", "Pricing"],
  sections: ["Hero", "Features", "CTA"],
  theme: {
    headline: "Modern and clear",
    background: "#faf7f2",
    surface: "#ffffff",
    accent: "#1f6feb",
    text: "#111827",
  },
  copyTone: "Confident and concise",
  features: ["Fast setup", "Issue-driven builds", "Direct deploys"],
  assetsNeeded: [],
  githubPagesConstraints: ["Interactive client-side pages only"],
  issueInputs: {
    primaryGoal: "Generate reliable interactive pages from issue briefs.",
    audience: ["Founders", "Operators"],
    coreScreens: ["Landing page", "Feature overview"],
    interactions: ["Primary CTA", "Navigation toggle"],
  },
  briefContext: {
    mainProblem: "Manual handoff from brief to site takes too long.",
    dataAndAuthNeeds: [],
    integrations: ["GitHub"],
    visualStyleDirection: ["Editorial"],
    targetUsers: ["Founders"],
    platformExpectations: ["Responsive web app"],
  },
};

describe("GLM generator templates", () => {
  it("emits a robust GLM workflow and implementation script", () => {
    const app = renderStarterApp(spec, "glm");

    const workflow = app.files.find((file) => file.path === ".github/workflows/agent.yml");
    const script = app.files.find((file) => file.path === ".github/scripts/implement-with-glm.mjs");
    const instructions = app.files.find((file) => file.path === "AGENT.md");
    const ciWorkflow = app.files.find((file) => file.path === ".github/workflows/ci.yml");

    expect(workflow?.content).toContain("continue-on-error: true");
    expect(workflow?.content).toContain("Post failure note");
    expect(workflow?.content).toContain("steps.implement.outcome != 'success'");
    expect(workflow?.content).toContain("Post no-change note");
    expect(ciWorkflow?.content).toContain("name: Interactive UI CI");
    expect(ciWorkflow?.content).toContain("verify-interactive-ui");

    expect(script?.content).toContain("async function callGlm(apiKey, messages)");
    expect(script?.content).toContain("function normalizeMessageContent(content)");
    expect(script?.content).toContain("function extractFirstJsonObject(content)");
    expect(script?.content).toContain("function parseModelJson(content)");
    expect(script?.content).toContain('appendOutput("error", message)');
    expect(script?.content).toContain("Generating:");
    expect(script?.content).toContain("IntersectionObserver for scroll reveals");
    expect(script?.content).toContain("INFRA_PATTERNS");
    expect(script?.content).toContain("Skipped infrastructure files:");
    expect(instructions?.content).toContain("Agent Implementation Guide");
  });
});
