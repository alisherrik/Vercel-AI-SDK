import type { AppSpec, GeneratedApp, GeneratedFile } from "@/lib/planner/schemas";

type AgentProvider = "copilot" | "claude" | "glm";

export function renderStarterApp(spec: AppSpec, agentProvider: AgentProvider): GeneratedApp {
  const pageFiles = spec.pages.map((page) => ({
    path: pageToFilename(page),
    content: renderSkeletonPage(spec, page),
  }));

  return {
    name: spec.appName,
    starterKind: spec.starterKind,
    files: [
      ...pageFiles,
      {
        path: "styles.css",
        content: renderSkeletonStyles(spec),
      },
      {
        path: "script.js",
        content: renderSkeletonScript(spec),
      },
      {
        path: ".nojekyll",
        content: "# Keep Pages from invoking Jekyll.",
      },
      {
        path: ".github/workflows/ci.yml",
        content: renderCiWorkflow(spec),
      },
      {
        path: ".github/workflows/deploy-pages.yml",
        content: renderDeployWorkflow(),
      },
      ...renderAgentFiles(spec, agentProvider),
    ],
  };
}

export function renderPreviewDocument(spec: AppSpec): string {
  return renderSkeletonPage(spec, "Home");
}

/* ── Page filename mapping ── */
export function pageToFilename(page: string): string {
  const slug = toId(page);
  if (slug === "home" || slug === "") return "index.html";
  return `${slug}.html`;
}

/* ── Skeleton HTML page ── */
function renderSkeletonPage(spec: AppSpec, page: string): string {
  const navLinks = spec.pages.map((p) => {
    const href = `./${pageToFilename(p)}`;
    const active = p === page ? ' class="nav-link active"' : ' class="nav-link"';
    return `<a href="${href}"${active}>${p}</a>`;
  }).join("\n        ");

  const pageTitle = page === "Home" ? spec.appName : `${page} — ${spec.appName}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle}</title>
    <meta name="description" content="${spec.issueInputs.primaryGoal}" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <header data-testid="site-header">
      <nav data-testid="primary-nav">
        <span class="brand">${spec.appName}</span>
        <div class="nav-links">
        ${navLinks}
        </div>
        <button class="menu-toggle" data-testid="mobile-nav-toggle" aria-label="Menu" aria-expanded="false">&#9776;</button>
      </nav>
    </header>

    <main data-testid="main-content" data-page="${toId(page)}">
      <h1>${page === "Home" ? spec.appName : page}</h1>
      <p>${spec.issueInputs.primaryGoal}</p>
      <!-- GLM will implement the full ${page} page content -->
    </main>

    <footer data-testid="footer-section">
      <p>&copy; ${spec.appName}</p>
    </footer>

    <script src="./script.js"></script>
  </body>
</html>`;
}

/* ── Skeleton CSS ── */
function renderSkeletonStyles(spec: AppSpec): string {
  return `:root {
  --bg: ${spec.theme.background};
  --surface: ${spec.theme.surface};
  --accent: ${spec.theme.accent};
  --text: ${spec.theme.text};
}

/* Reset */
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

/* GLM will replace all styles below with a complete, polished design */
nav { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; background: var(--surface); }
.brand { font-weight: 700; font-size: 1.2rem; }
.nav-links { display: flex; gap: 1rem; }
.nav-link { text-decoration: none; color: var(--text); }
.nav-link.active { color: var(--accent); font-weight: 600; }
.menu-toggle { display: none; background: none; border: 1px solid var(--text); padding: 0.3rem 0.6rem; cursor: pointer; font-size: 1.2rem; border-radius: 4px; }
main { padding: 2rem; }
footer { padding: 1rem 2rem; text-align: center; border-top: 1px solid #ddd; margin-top: 2rem; }
@media (max-width: 768px) {
  .menu-toggle { display: block; }
  .nav-links { display: none; }
  .nav-links.open { display: flex; flex-direction: column; }
}
`;
}

/* ── Skeleton JS ── */
function renderSkeletonScript(spec: AppSpec): string {
  return `document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('[data-testid="mobile-nav-toggle"]');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      navLinks.classList.toggle('open');
    });
  }

  /* GLM will implement all interactivity for: ${spec.issueInputs.interactions.join(", ")} */
});
`;
}

function renderCiWorkflow(spec: AppSpec): string {
  const pageFiles = spec.pages.map((p) => pageToFilename(p));
  const existChecks = pageFiles.map((f) => `          test -f ${f}`).join("\n");
  const assetChecks = pageFiles.map((f) => [
    `          grep -q 'href="./styles.css"' ${f}`,
    `          grep -q 'src="./script.js"' ${f}`,
  ].join("\n")).join("\n");

  return `name: Interactive UI CI

on:
  pull_request:
  push:
    branches: ["main"]

permissions:
  contents: read

jobs:
  verify-interactive-ui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check entrypoints
        run: |
${existChecks}
          test -f styles.css
          test -f script.js
      - name: Check linked assets
        run: |
${assetChecks}
          grep -q 'data-testid="main-content"' index.html
`;
}

function renderDeployWorkflow(): string {
  return `name: Deploy GitHub Pages

on:
  workflow_run:
    workflows: ["Implementation Agent"]
    types: [completed]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    if: \${{ github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate interactive starter
        run: |
          test -f index.html
          test -f styles.css
          test -f script.js
          grep -q 'href="./styles.css"' index.html
          grep -q 'src="./script.js"' index.html
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
  deploy:
    needs: build
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`;
}

function renderAgentFiles(spec: AppSpec, agentProvider: AgentProvider): GeneratedFile[] {
  if (agentProvider === "copilot") {
    return [];
  }

  const files: GeneratedFile[] = [
    {
      path: ".github/workflows/agent.yml",
      content:
        agentProvider === "glm"
          ? renderGlmWorkflow()
          : renderClaudeWorkflow(),
    },
    {
      path: "AGENT.md",
      content: renderAgentInstructions(spec, agentProvider),
    },
  ];

  if (agentProvider === "glm") {
    files.push({
      path: ".github/scripts/implement-with-glm.mjs",
      content: renderGlmImplementationScript(),
    });
  }

  return files;
}

function renderClaudeWorkflow(): string {
  return `name: Implementation Agent

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  agent:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          model: claude-haiku-4-20250414
          max_turns: 3
          allowed_tools: "Bash,View,GlobTool,GrepTool,BatchTool,mcp__github"
`;
}

function renderGlmWorkflow(): string {
  return `name: Implementation Agent

on:
  issue_comment:
    types: [created]

permissions:
  contents: write
  issues: write

jobs:
  agent:
    if: contains(github.event.comment.body, '@glm')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run GLM-4 implementation
        id: implement
        continue-on-error: true
        env:
          BIGMODEL_API_KEY: \${{ secrets.BIGMODEL_API_KEY }}
          BIGMODEL_BASE_URL: https://open.bigmodel.cn/api/paas/v4/chat/completions
          BIGMODEL_MODEL: glm-5
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node .github/scripts/implement-with-glm.mjs
      - name: Commit implementation
        if: steps.implement.outcome == 'success' && steps.implement.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "feat: implement issue #\${{ github.event.issue.number }} with GLM-5"
          git pull --rebase origin \${{ github.event.repository.default_branch }}
          git push origin HEAD:\${{ github.event.repository.default_branch }}
      - name: Post completion note
        if: steps.implement.outcome == 'success' && steps.implement.outputs.changed == 'true'
        env:
          GH_TOKEN: \${{ github.token }}
          GLM_SUMMARY: \${{ steps.implement.outputs.summary }}
        run: |
          gh issue comment "\${{ github.event.issue.number }}" \\
            --repo "\${{ github.repository }}" \\
            --body "GLM-5 committed the requested implementation directly to the default branch.

          Summary: \$GLM_SUMMARY"
      - name: Post no-change note
        if: steps.implement.outcome == 'success' && steps.implement.outputs.changed != 'true'
        env:
          GH_TOKEN: \${{ github.token }}
          GLM_SUMMARY: \${{ steps.implement.outputs.summary }}
        run: |
          gh issue comment "\${{ github.event.issue.number }}" \\
            --repo "\${{ github.repository }}" \\
            --body "GLM-5 reviewed the issue but did not produce file changes.

          Summary: \$GLM_SUMMARY"
      - name: Post failure note
        if: steps.implement.outcome != 'success'
        env:
          GH_TOKEN: \${{ github.token }}
          GLM_ERROR: \${{ steps.implement.outputs.error }}
        run: |
          gh issue comment "\${{ github.event.issue.number }}" \\
            --repo "\${{ github.repository }}" \\
            --body "GLM-5 could not complete the implementation run.

          Error: \$GLM_ERROR"
`;
}

function renderAgentInstructions(spec: AppSpec, agentProvider: AgentProvider): string {
  const agentName = agentProvider === "glm" ? "GLM-5" : "Claude";
  const userDesc = spec.briefContext?.userDescription || "";
  const projectContext = [
    `## Project: ${spec.appName}`,
    "",
    userDesc ? `**What to build:** ${userDesc}` : "",
    `**Primary goal:** ${spec.issueInputs.primaryGoal}`,
    spec.briefContext?.mainProblem ? `**Problem being solved:** ${spec.briefContext.mainProblem}` : "",
    spec.briefContext?.targetUsers?.length ? `**Target users:** ${spec.briefContext.targetUsers.join(", ")}` : "",
    spec.briefContext?.visualStyleDirection?.length ? `**Visual style:** ${spec.briefContext.visualStyleDirection.join(", ")}` : "",
    `**Pages:** ${spec.pages.join(", ")}`,
    `**Sections:** ${spec.sections.join(", ")}`,
    `**Features:** ${spec.features.join(", ")}`,
    `**Copy tone:** ${spec.copyTone}`,
    `**Theme:** background ${spec.theme.background}, surface ${spec.theme.surface}, accent ${spec.theme.accent}, text ${spec.theme.text}`,
  ].filter(Boolean).join("\n");

  return `# ${spec.appName} — Agent Implementation Guide

You are the **${agentName}** implementation agent for this repository.
Follow the issue scope exactly and build production-quality interactive pages.
Build EXACTLY what the user described — not a generic template.

${projectContext}

## Core Rules
- All pages must be **static client-side only** (GitHub Pages compatible).
- Use **only** HTML, CSS, and vanilla JavaScript. No frameworks, no build tools, no npm.
- Commit finished work directly to the default branch.
- Do not introduce server runtimes, backend APIs, databases, or secrets.

## Quality Standards

### HTML
- Use semantic HTML5 elements: \`<header>\`, \`<nav>\`, \`<main>\`, \`<section>\`, \`<article>\`, \`<footer>\`.
- Every interactive element must have \`aria-*\` attributes for accessibility.
- Include \`<meta name="viewport">\` for responsive design.
- All images must have \`alt\` attributes. Use SVG or CSS for icons/illustrations.

### CSS
- Use CSS custom properties (\`--var\`) for theming (colors, spacing, radius).
- Mobile-first responsive design with \`@media\` breakpoints at 768px and 1024px.
- Add smooth transitions: \`transition: all 0.3s ease\` on interactive elements.
- Use \`hover\`, \`focus\`, and \`active\` states on all clickable elements.
- Implement subtle animations: fade-ins with \`@keyframes\`, scroll reveals, hover lifts.
- Use \`box-shadow\` for depth. Cards should have hover elevation changes.
- Typography: use \`clamp()\` for fluid font sizes. Set \`line-height: 1.6\` for body.

### JavaScript Interactivity
- **Required interactions:** mobile nav toggle, smooth scroll, scroll-triggered animations,
  active nav highlighting, tab/accordion components if content warrants them.
- Use \`IntersectionObserver\` for scroll-based reveal animations.
- Use \`classList.toggle\` for state changes, never inline styles.
- If the page has data/metrics, render dynamic charts using \`<canvas>\` or CSS-only charts.
- Add \`data-testid\` attributes on key sections for CI testing.
- All JS must be in \`DOMContentLoaded\` or deferred.

### Visual Design
- Create a polished, modern look — not a wireframe or placeholder.
- Use gradients, glassmorphism, or neumorphism where appropriate.
- Hero sections should be visually striking with large typography and clear CTAs.
- Feature grids should use cards with icons, consistent padding, and alignment.
- Footer should have multiple columns with links.
- Use CSS Grid and Flexbox for layouts, never floats.

## Anti-Patterns (DO NOT)
- Do not output placeholder text like "Lorem ipsum" or "Coming soon".
- Do not create empty sections or stub functions.
- Do not use \`alert()\` or \`document.write()\`.
- Do not use inline \`style=\` attributes.
- Do not leave console.log statements in production code.
`;
}

function renderGlmImplementationScript(): string {
  return `import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_MODEL = process.env.BIGMODEL_MODEL || "glm-5";
const DEFAULT_URL =
  process.env.BIGMODEL_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

async function main() {
  const apiKey = process.env.BIGMODEL_API_KEY?.trim();
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!apiKey) {
    throw new Error("BIGMODEL_API_KEY is required.");
  }

  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is required.");
  }

  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const issue = event.issue;
  const comment = event.comment;
  const issueBody = typeof issue?.body === "string" ? issue.body : "";
  const allAllowedFiles = parseBulletedSection(issueBody, "Allowed files:");

  // Infrastructure files that GLM must never regenerate
  const INFRA_PATTERNS = [
    ".github/workflows/",
    ".github/scripts/",
    "AGENT.md",
    ".nojekyll",
  ];
  const allowedFiles = allAllowedFiles.filter(
    (f) => !INFRA_PATTERNS.some((p) => f.startsWith(p) || f === p),
  );

  if (!allowedFiles.length) {
    throw new Error("No content files to generate (all allowed files are infrastructure).");
  }

  console.log("Content files to generate:", allowedFiles.join(", "));
  if (allAllowedFiles.length !== allowedFiles.length) {
    const skipped = allAllowedFiles.filter((f) => !allowedFiles.includes(f));
    console.log("Skipped infrastructure files:", skipped.join(", "));
  }

  const currentFiles = await Promise.all(
    allowedFiles.map(async (filePath) => ({
      path: filePath,
      content: existsSync(filePath) ? await readFile(filePath, "utf8") : "",
    })),
  );

  const agentInstructions = existsSync("AGENT.md") ? await readFile("AGENT.md", "utf8") : "";

  // ── Step 1: Ask GLM for a plan (which files to update and a brief description) ──
  const planResponse = await callGlm(apiKey, [
    {
      role: "system",
      content: [
        "You are a senior front-end architect who builds polished, interactive websites.",
        "Read the AGENT.md instructions and issue body CAREFULLY — they describe EXACTLY what app to build.",
        "Your job is to plan an implementation that matches the user's specific request, NOT a generic template.",
        "Analyze the issue and plan the implementation. Return ONLY a JSON object:",
        '{ "summary": "what you will build (be specific to the user request)", "filePlan": [{ "path": "file.html", "description": "detailed description of content and interactions specific to this project" }] }',
        "",
        "Planning rules:",
        "- Only include files from the allowed list.",
        "- Do not return file contents yet, only the detailed plan.",
        "- Read the issue body and AGENT.md to understand what specific app is being built.",
        "- For index.html: plan the specific page described by the user — with relevant sections, content, and features.",
        "- For styles.css: plan design that matches the project theme and visual style described.",
        "- For script.js: plan interactivity specific to this app — not generic nav toggle only.",
        "- The description for each file should be 3-5 sentences explaining exactly what to build for THIS specific project.",
        "- Do not include markdown fences in your response.",
      ].join("\\n"),
    },
    {
      role: "user",
      content: buildUserPrompt(issue, comment, issueBody, agentInstructions, currentFiles),
    },
  ]);

  const plan = parseModelJson(planResponse);

  if (!Array.isArray(plan.filePlan) || plan.filePlan.length === 0) {
    throw new Error("GLM did not return a file plan.");
  }

  const summary = typeof plan.summary === "string" ? plan.summary : "Implementation complete.";
  console.log("Plan:", summary);
  console.log("Files to update:", plan.filePlan.map((f) => f.path).join(", "));

  // ── Step 2: Generate each file individually ──
  for (const filePlan of plan.filePlan) {
    if (!filePlan || typeof filePlan.path !== "string") continue;
    if (!allowedFiles.includes(filePlan.path)) {
      console.warn(\`Skipping disallowed file: \${filePlan.path}\`);
      continue;
    }

    const existingContent = currentFiles.find((f) => f.path === filePlan.path)?.content || "";

    console.log(\`Generating: \${filePlan.path}...\`);
    const fileResponse = await callGlm(apiKey, [
      {
        role: "system",
        content: [
          "You are an elite front-end developer who writes production-quality code.",
          "Return ONLY the raw file content — no JSON, no markdown fences, no explanations.",
          "The output will be saved directly to disk as-is.",
          "",
          "CRITICAL: Read the agent instructions and issue body to understand EXACTLY what app is being built.",
          "Build what the user described — with real, relevant content specific to this project.",
          "Do NOT build a generic landing page. Build the SPECIFIC app/site described in the instructions.",
          "",
          "Quality requirements:",
          "- Write COMPLETE, polished code — not stubs or placeholders.",
          "- Use real, relevant content that matches the project description (product names, prices, descriptions, etc.).",
          "- HTML: semantic elements, accessibility attributes, responsive meta tags.",
          "- CSS: custom properties for theming, mobile-first @media queries, smooth transitions,",
          "  hover/focus/active states, subtle animations (@keyframes fade-in, slide-up),",
          "  modern layout with CSS Grid/Flexbox, box-shadows for depth, clamp() for fluid type.",
          "- JS: IntersectionObserver for scroll reveals, classList.toggle for state,",
          "  smooth scrolling, mobile nav hamburger, dynamic content rendering,",
          "  data-testid attributes on key sections, all code inside DOMContentLoaded.",
          "- Visual: modern gradients, card hover elevation, striking hero section,",
          "  real content (not lorem ipsum), polished typography and spacing.",
          "- NO inline styles, NO alert(), NO console.log, NO placeholder text.",
        ].join("\\n"),
      },
      {
        role: "user",
        content: [
          \`File: \${filePlan.path}\`,
          \`Task: \${filePlan.description || plan.summary}\`,
          "",
          "Agent instructions:",
          agentInstructions || "None.",
          "",
          "Issue body:",
          issueBody,
          "",
          existingContent
            ? \`Current file content:\\n\${existingContent}\`
            : "This is a new file, create it from scratch.",
        ].join("\\n"),
      },
    ]);

    const dir = dirname(filePlan.path);
    if (dir && dir !== ".") {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(filePlan.path, fileResponse, "utf8");
    console.log(\`  Wrote: \${filePlan.path} (\${fileResponse.length} chars)\`);
  }

  const changedFiles = listChangedFiles();

  if (changedFiles.length === 0) {
    console.log("GLM-5 produced no file changes.");
    await appendOutput("changed", "false");
    await appendOutput("summary", summary);
  } else {
    console.log(\`Updated files: \${changedFiles.join(", ")}\`);
    await appendOutput("changed", "true");
    await appendOutput("summary", summary);
  }
}

async function callGlm(apiKey, messages) {
  const response = await fetch(DEFAULT_URL, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      stream: false,
      temperature: 0.2,
      max_tokens: 65536,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(\`BigModel request failed (\${response.status}): \${await response.text()}\`);
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;
  return normalizeMessageContent(rawContent);
}

function buildUserPrompt(issue, comment, issueBody, agentInstructions, currentFiles) {
  return [
    \`Repository: \${process.env.GITHUB_REPOSITORY || ""}\`,
    \`Issue #\${issue?.number || ""}: \${issue?.title || ""}\`,
    "",
    "Agent instructions:",
    agentInstructions || "None provided.",
    "",
    "Kickoff comment:",
    typeof comment?.body === "string" ? comment.body : "",
    "",
    "Issue body:",
    issueBody,
    "",
    "Allowed files:",
    currentFiles.map((f) => \`- \${f.path}\`).join("\\n"),
  ].join("\\n");
}

function parseBulletedSection(body, heading) {
  const normalizedHeading = heading.trim().toLowerCase();
  const lines = body.split(/\\r?\\n/);
  const startIndex = lines.findIndex((line) => line.trim().toLowerCase() === normalizedHeading);

  if (startIndex === -1) {
    return [];
  }

  const items = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      if (items.length > 0) {
        break;
      }
      continue;
    }

    if (!line.startsWith("- ")) {
      if (items.length > 0) {
        break;
      }
      continue;
    }

    items.push(line.slice(2).trim());
  }

  return items;
}

function parseModelJson(content) {
  const trimmed = stripMarkdownFences(content).trim();

  // Strategy 1: direct parse
  try {
    return JSON.parse(trimmed);
  } catch {}

  // Strategy 2: fix unescaped chars inside strings + trailing commas
  const fixed = removeTrailingCommas(fixUnescapedStrings(trimmed));
  try {
    return JSON.parse(fixed);
  } catch {}

  // Strategy 3: extract first JSON object via balanced-braces scan
  const candidate = extractFirstJsonObject(content);
  if (candidate) {
    try {
      return JSON.parse(candidate);
    } catch {}
    const fixedCandidate = removeTrailingCommas(fixUnescapedStrings(candidate));
    try {
      return JSON.parse(fixedCandidate);
    } catch {}
  }

  // Strategy 4: try to repair truncated JSON
  const repaired = repairTruncatedJson(fixed || trimmed);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch {}
  }

  console.error("=== JSON PARSE FAILED ===");
  console.error("First 500 chars:", content.slice(0, 500));
  console.error("Last 200 chars:", content.slice(-200));
  throw new Error("Unable to parse JSON returned by BigModel.");
}

function fixUnescapedStrings(text) {
  const out = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (esc) { out.push(c); esc = false; continue; }
    if (c === "\\\\" && inStr) { out.push(c); esc = true; continue; }
    if (c === '"') { inStr = !inStr; out.push(c); continue; }
    if (inStr && c === "\\n") { out.push("\\\\n"); continue; }
    if (inStr && c === "\\r") { out.push("\\\\r"); continue; }
    if (inStr && c === "\\t") { out.push("\\\\t"); continue; }
    out.push(c);
  }
  return out.join("");
}

function removeTrailingCommas(text) {
  return text.replace(/,\\s*([}\\]])/g, "$1");
}

function repairTruncatedJson(text) {
  // If the JSON is truncated mid-response, try to close open structures
  let s = text.trim();
  if (!s.startsWith("{")) return null;

  // Close any open string
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\\\" && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; }
  }
  if (inStr) {
    s += '"';
  }

  // Count open braces and brackets, close them
  let braces = 0;
  let brackets = 0;
  inStr = false;
  esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\\\" && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (c === "{") braces++;
      if (c === "}") braces--;
      if (c === "[") brackets++;
      if (c === "]") brackets--;
    }
  }

  // Remove any trailing comma before closing
  s = s.replace(/,\\s*$/, "");
  while (brackets > 0) { s += "]"; brackets--; }
  while (braces > 0) { s += "}"; braces--; }

  return s;
}

function normalizeMessageContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          if (typeof item.text === "string") {
            return item.text;
          }

          if (item.type === "text" && typeof item.content === "string") {
            return item.content;
          }
        }

        return "";
      })
      .join("");
  }

  return "";
}

function stripMarkdownFences(content) {
  return content
    .replace(/^\\s*\\\`\\\`\\\`(?:json)?\\s*/i, "")
    .replace(/\\s*\\\`\\\`\\\`\\s*$/i, "");
}

function extractFirstJsonObject(content) {
  const start = content.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }

  return null;
}

function readFileContent(file) {
  if (typeof file.contentBase64 === "string") {
    return Buffer.from(file.contentBase64, "base64").toString("utf8");
  }

  if (typeof file.content === "string") {
    return file.content;
  }

  throw new Error(\`BigModel did not provide content for \${file.path}.\`);
}

async function appendOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  const normalized = String(value ?? "").replace(/\\r/g, "").trim();
  await writeFile(outputPath, \`\${name}<<__GLM__\\n\${normalized}\\n__GLM__\\n\`, {
    encoding: "utf8",
    flag: "a",
  });
}

function listChangedFiles() {
  const output = execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim();
  if (!output) {
    return [];
  }

  return output
    .split(/\\r?\\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

main().catch((error) => {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  appendOutput("changed", "false")
    .then(() => appendOutput("error", message))
    .finally(() => {
      process.exitCode = 1;
    });
});
`;
}

function toId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
