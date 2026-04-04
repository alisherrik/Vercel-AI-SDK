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
    const deployWorkflow = app.files.find((file) => file.path === ".github/workflows/deploy-pages.yml");

    expect(workflow?.content).toContain("continue-on-error: true");
    expect(workflow?.content).toContain("Post failure note");
    expect(workflow?.content).toContain("steps.implement.outcome != 'success'");
    expect(workflow?.content).toContain("Post no-change note");
    expect(workflow?.content).toContain("BIGMODEL_MODEL: glm-4.5-air");
    expect(ciWorkflow?.content).toContain("name: Interactive UI CI");
    expect(ciWorkflow?.content).toContain("verify-interactive-ui");

    expect(script?.content).toContain("async function callGlm(apiKey, messages)");
    expect(script?.content).toContain("function normalizeMessageContent(content)");
    expect(script?.content).toContain("function extractFirstJsonObject(content)");
    expect(script?.content).toContain("function parseModelJson(content)");
    expect(script?.content).toContain('appendOutput("error", message)');
    expect(script?.content).toContain("Generating:");
    expect(script?.content).toContain("IntersectionObserver for .reveal elements");
    expect(script?.content).toContain("INFRA_PATTERNS");
    expect(script?.content).toContain("Skipped infrastructure files:");
    expect(script?.content).toContain('"glm-4.5-air"');
    expect(instructions?.content).toContain("Agent Implementation Guide");

    // Deploy only after Implementation Agent completes
    expect(deployWorkflow?.content).toContain('workflows: ["Implementation Agent"]');
    expect(deployWorkflow?.content).toContain("workflow_run");
  });

  it("generates multi-page skeleton files", () => {
    const app = renderStarterApp(spec, "glm");

    const indexPage = app.files.find((file) => file.path === "index.html");
    const featuresPage = app.files.find((file) => file.path === "features.html");
    const pricingPage = app.files.find((file) => file.path === "pricing.html");
    const styles = app.files.find((file) => file.path === "styles.css");
    const script = app.files.find((file) => file.path === "script.js");

    expect(indexPage).toBeDefined();
    expect(featuresPage).toBeDefined();
    expect(pricingPage).toBeDefined();
    expect(styles).toBeDefined();
    expect(script).toBeDefined();

    // Each page should link to shared styles/script
    expect(indexPage?.content).toContain('href="./styles.css"');
    expect(indexPage?.content).toContain('src="./script.js"');
    expect(featuresPage?.content).toContain('href="./styles.css"');
    expect(pricingPage?.content).toContain('href="./styles.css"');

    // Each page should have nav links to other pages
    expect(indexPage?.content).toContain('href="./features.html"');
    expect(indexPage?.content).toContain('href="./pricing.html"');
    expect(featuresPage?.content).toContain('href="./index.html"');

    // Pages should be skeletons (minimal), not pre-built content
    expect(indexPage?.content).toContain("GLM will implement");
    expect(indexPage?.content).toContain('data-testid="main-content"');

    // CI should check all page files
    const ciWorkflow = app.files.find((file) => file.path === ".github/workflows/ci.yml");
    expect(ciWorkflow?.content).toContain("test -f index.html");
    expect(ciWorkflow?.content).toContain("test -f features.html");
    expect(ciWorkflow?.content).toContain("test -f pricing.html");
  });
});
