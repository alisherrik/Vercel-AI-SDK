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

/* ── Skeleton CSS with Design System ── */
function renderSkeletonStyles(spec: AppSpec): string {
  // Derive palette variations from the accent color
  return `:root {
  /* ── Core palette ── */
  --bg: ${spec.theme.background};
  --surface: ${spec.theme.surface};
  --accent: ${spec.theme.accent};
  --text: ${spec.theme.text};
  --accent-light: color-mix(in srgb, var(--accent) 12%, transparent);
  --accent-hover: color-mix(in srgb, var(--accent) 85%, #000);
  --muted: color-mix(in srgb, var(--text) 55%, transparent);
  --border: color-mix(in srgb, var(--text) 8%, transparent);
  --border-hover: color-mix(in srgb, var(--text) 16%, transparent);

  /* ── Spacing scale ── */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;

  /* ── Typography scale (fluid) ── */
  --text-xs: clamp(0.7rem, 0.65rem + 0.25vw, 0.8rem);
  --text-sm: clamp(0.8rem, 0.75rem + 0.25vw, 0.875rem);
  --text-base: clamp(0.9rem, 0.85rem + 0.3vw, 1rem);
  --text-lg: clamp(1.05rem, 0.95rem + 0.5vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1rem + 1.1vw, 1.75rem);
  --text-2xl: clamp(1.5rem, 1.1rem + 1.8vw, 2.25rem);
  --text-3xl: clamp(1.8rem, 1.2rem + 2.8vw, 3rem);
  --text-4xl: clamp(2.2rem, 1.3rem + 4vw, 4rem);
  --text-hero: clamp(2.5rem, 1.5rem + 5vw, 5rem);

  /* ── Shadows ── */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 10px 25px -3px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 50px -5px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.04);
  --shadow-glow: 0 0 20px color-mix(in srgb, var(--accent) 25%, transparent);

  /* ── Radii ── */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* ── Transitions ── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* ── Animation keyframes library ── */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
@keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

/* ── Scroll-reveal class (JS adds .is-visible) ── */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--duration-slow) var(--ease-out), transform var(--duration-slow) var(--ease-out);
}
.reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Minimal structural styles (GLM replaces everything below) ── */
nav { display: flex; align-items: center; justify-content: space-between; padding: var(--space-md) var(--space-xl); background: var(--surface); }
.brand { font-weight: 700; font-size: var(--text-lg); letter-spacing: -0.02em; }
.nav-links { display: flex; gap: var(--space-md); }
.nav-link { text-decoration: none; color: var(--text); font-size: var(--text-sm); font-weight: 500; transition: color var(--duration-fast); }
.nav-link:hover { color: var(--accent); }
.nav-link.active { color: var(--accent); font-weight: 600; }
.menu-toggle { display: none; background: none; border: 1px solid var(--border); padding: var(--space-xs) var(--space-sm); cursor: pointer; font-size: var(--text-lg); border-radius: var(--radius-sm); }
main { padding: var(--space-xl); }
footer { padding: var(--space-md) var(--space-xl); text-align: center; border-top: 1px solid var(--border); margin-top: var(--space-2xl); }
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
          BIGMODEL_MODEL: glm-4.5-air
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node .github/scripts/implement-with-glm.mjs
      - name: Commit implementation
        if: steps.implement.outcome == 'success' && steps.implement.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "feat: implement issue #\${{ github.event.issue.number }} with GLM-4.5-Air"
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
            --body "GLM-4.5-Air committed the requested implementation directly to the default branch.

          Summary: \$GLM_SUMMARY"
      - name: Post no-change note
        if: steps.implement.outcome == 'success' && steps.implement.outputs.changed != 'true'
        env:
          GH_TOKEN: \${{ github.token }}
          GLM_SUMMARY: \${{ steps.implement.outputs.summary }}
        run: |
          gh issue comment "\${{ github.event.issue.number }}" \\
            --repo "\${{ github.repository }}" \\
            --body "GLM-4.5-Air reviewed the issue but did not produce file changes.

          Summary: \$GLM_SUMMARY"
      - name: Post failure note
        if: steps.implement.outcome != 'success'
        env:
          GH_TOKEN: \${{ github.token }}
          GLM_ERROR: \${{ steps.implement.outputs.error }}
        run: |
          gh issue comment "\${{ github.event.issue.number }}" \\
            --repo "\${{ github.repository }}" \\
            --body "GLM-4.5-Air could not complete the implementation run.

          Error: \$GLM_ERROR"
`;
}

function renderAgentInstructions(spec: AppSpec, agentProvider: AgentProvider): string {
  const agentName = agentProvider === "glm" ? "GLM-4.5-Air" : "Claude";
  const userDesc = spec.briefContext?.userDescription || "";
  const glmHtmlPrototypeMode =
    agentProvider === "glm"
      ? `
## GLM HTML Prototype Mode

When you are generating an \`.html\` file, treat it like a premium standalone prototype page, even though this repo keeps shared CSS in \`styles.css\` and shared JavaScript in \`script.js\`.

- Output ONLY raw HTML for HTML files. The first characters must be \`<!DOCTYPE html>\` and the file must end with \`</html>\`.
- Keep \`<link rel="stylesheet" href="./styles.css">\` and \`<script src="./script.js"></script>\` intact.
- Build a polished, real-feeling product page with meaningful copy. Never use lorem ipsum, "coming soon", or filler placeholders.
- Each HTML page should include at least 5 meaningful sections. If the brief is thin, add sensible sections like social proof, FAQ, pricing, testimonials, timeline, or CTA banner.
- Use lowercase hyphenated section ids and make navigation/CTA links point to real ids that exist in the page.
- The first/main page should include a bold hero section with a clear headline and primary call to action. Secondary pages should still open with a strong intro block.
- Use realistic domain-appropriate placeholder content: names, pricing, headlines, descriptions, FAQs, and testimonials that match the product category.
- For photos or mock imagery, use varied \`https://picsum.photos/seed/{unique-name}/{width}/{height}\` URLs. For icons, use inline SVG or Unicode only.
- Include at least one expandable or modal-style detail surface whenever the product brief suggests details, contact, booking, pricing, or feature drill-downs.
- JavaScript hooks must be real: every selector used by \`script.js\` should correspond to elements that exist in the HTML.
- Be careful with JavaScript strings: escape apostrophes inside single-quoted strings as \`\\'\`, and never use smart quotes.
`
      : "";
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

${glmHtmlPrototypeMode}

## Design System

The \`styles.css\` file ships with a complete design-token system. You MUST use these tokens everywhere
instead of hard-coded values. This guarantees visual consistency:

\`\`\`
/* Already defined in :root — just USE them: */
var(--bg)  var(--surface)  var(--accent)  var(--text)
var(--accent-light)  var(--accent-hover)  var(--muted)  var(--border)
var(--space-xs..4xl)  var(--text-xs..hero)
var(--shadow-xs..xl)  var(--shadow-glow)
var(--radius-sm..full)
var(--ease-out)  var(--ease-spring)  var(--duration-fast/normal/slow)
\`\`\`

Animation keyframes already defined: \`fadeIn\`, \`fadeUp\`, \`fadeDown\`, \`slideInLeft\`, \`slideInRight\`, \`scaleIn\`, \`shimmer\`, \`float\`, \`pulse\`, \`gradient\`.

Use \`.reveal\` class + JS \`IntersectionObserver\` to add \`.is-visible\` for scroll animations.

## Visual Design Reference (target: Stripe / Linear / Vercel quality)

### Hero Section Pattern
\`\`\`css
.hero {
  min-height: 80vh;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  background: linear-gradient(135deg, var(--bg) 0%, var(--surface) 50%, color-mix(in srgb, var(--accent) 5%, var(--bg)) 100%);
  position: relative; overflow: hidden;
}
.hero::before { /* subtle gradient orb */
  content: ''; position: absolute; width: 600px; height: 600px;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent), transparent 70%);
  top: -200px; right: -100px; pointer-events: none;
}
.hero h1 {
  font-size: var(--text-hero); font-weight: 800;
  letter-spacing: -0.04em; line-height: 1.05;
  background: linear-gradient(135deg, var(--text), var(--accent));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
\`\`\`

### Glass Card Pattern
\`\`\`css
.glass-card {
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-xl);
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}
.glass-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}
\`\`\`

### Gradient Button Pattern
\`\`\`css
.btn-primary {
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: white; font-weight: 600; font-size: var(--text-sm);
  border: none; cursor: pointer;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent);
  transition: all var(--duration-normal) var(--ease-spring);
}
.btn-primary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--accent) 40%, transparent);
}
\`\`\`

### Sticky Nav with Blur
\`\`\`css
.navbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  padding: var(--space-md) var(--space-2xl);
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(12px) saturate(150%);
  border-bottom: 1px solid var(--border);
  transition: background var(--duration-normal);
}
\`\`\`

### Feature Grid with Staggered Animation
\`\`\`css
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); }
.feature-card {
  padding: var(--space-xl); border-radius: var(--radius-lg);
  background: var(--surface); border: 1px solid var(--border);
  transition: all var(--duration-normal) var(--ease-out);
}
.feature-card:hover { border-color: var(--accent); box-shadow: var(--shadow-glow); transform: translateY(-2px); }
.feature-icon {
  width: 48px; height: 48px; border-radius: var(--radius-md);
  background: var(--accent-light); display: flex; align-items: center; justify-content: center;
  margin-bottom: var(--space-md); font-size: 1.5rem;
}
\`\`\`

### Section Spacing & Dividers
\`\`\`css
section { padding: var(--space-4xl) var(--space-2xl); }
.section-label {
  font-size: var(--text-xs); font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.15em; color: var(--accent); margin-bottom: var(--space-sm);
}
.section-title {
  font-size: var(--text-3xl); font-weight: 800;
  letter-spacing: -0.03em; margin-bottom: var(--space-lg);
}
.container { max-width: 1200px; margin: 0 auto; padding: 0 var(--space-lg); }
\`\`\`

## Quality Standards

### HTML
- Use semantic HTML5: \`<header>\`, \`<nav>\`, \`<main>\`, \`<section>\`, \`<article>\`, \`<footer>\`.
- Every interactive element must have \`aria-*\` attributes.
- Include \`<meta name="viewport">\` and \`<link rel="preconnect" href="https://fonts.googleapis.com">\`.
- Add Google Fonts \`<link>\` for Inter font (weights 400, 500, 600, 700, 800).
- Use SVG inline or CSS for all icons — never image URLs.
- Add \`data-testid\` attributes on key sections.

### CSS
- Use the design tokens from \`:root\` — NEVER hard-code colors, spacing, or font sizes.
- Mobile-first responsive design with breakpoints at 768px and 1024px.
- Every interactive element needs \`hover\`, \`focus-visible\`, and \`active\` states.
- Use CSS Grid for page layouts, Flexbox for component internals.
- Apply \`transition\` on all interactive elements using the token durations.
- Use \`backdrop-filter: blur()\` for glass effects on nav and cards.
- Use \`background: linear-gradient()\` for visual depth in hero and CTA sections.
- Add \`::before\` / \`::after\` pseudo-elements for decorative gradient orbs.
- Cards must elevate on hover (\`translateY(-4px)\` + shadow increase).
- Use \`clamp()\` vars for fluid typography — never fixed \`px\` font sizes.
- Section padding should use \`var(--space-4xl)\` for generous whitespace.

### JavaScript
- Use \`IntersectionObserver\` to toggle \`.is-visible\` on \`.reveal\` elements for scroll animations.
- Smooth scroll for anchor links.
- Mobile hamburger menu with animated open/close.
- Active nav link highlighting on scroll.
- Add staggered delays to card animations using \`transitionDelay\`.
- Tab/accordion components only if relevant to the page content.
- All code inside \`DOMContentLoaded\`.

## Anti-Patterns (DO NOT)
- Do not output placeholder text like "Lorem ipsum" or "Coming soon".
- Do not create empty sections or stub functions.
- Do not use \`alert()\` or \`document.write()\`.
- Do not use inline \`style=\` attributes (except for stagger delays).
- Do not leave \`console.log\` in production code.
- Do not use fixed pixel values for spacing — always use \`var(--space-*)\`.
- Do not hard-code colors — always reference \`var(--accent)\`, \`var(--text)\`, etc.
- Do not create flat, boring layouts — every section must have visual depth via shadows, gradients, or blur.
`;
}

function renderGlmImplementationScript(): string {
  return `import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_MODEL = process.env.BIGMODEL_MODEL || "glm-4.5-air";
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
        "You are an award-winning front-end architect who builds websites that rival Stripe, Linear, and Vercel in visual polish.",
        "Read the AGENT.md instructions and issue body CAREFULLY — they describe EXACTLY what app to build.",
        "Your job is to plan an implementation with PREMIUM UI quality — not a generic template.",
        "Think about the design holistically: color harmony, whitespace, visual hierarchy, micro-interactions, depth via shadows and gradients.",
        "",
        "Analyze the issue and plan the implementation. Return ONLY a JSON object:",
        '{ "summary": "what you will build (be specific to the user request)", "filePlan": [{ "path": "file.html", "description": "detailed description of content, visual design, and interactions specific to this project" }] }',
        "",
        "Planning rules:",
        "- Only include files from the allowed list.",
        "- Do not return file contents yet, only the detailed plan.",
        "- Read the issue body and AGENT.md to understand what specific app is being built.",
        "- AGENT.md contains a full Design System section with CSS pattern examples — STUDY IT and use those patterns.",
        "- For each HTML page: plan specific sections with detailed visual descriptions (hero gradient, glass cards, animated grids, etc.).",
        "- For styles.css: plan a visually striking design using the design tokens from :root — describe specific effects (glassmorphism nav, gradient orbs, hover elevations, staggered reveals).",
        "- For script.js: plan scroll-triggered reveal animations, smooth scrolling, mobile menu animation, active nav tracking, and any app-specific interactions.",
        "- The description for each file should be 5-8 sentences with SPECIFIC visual and interaction details.",
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
          "You are an elite front-end developer who builds websites with PREMIUM visual quality — as polished as Stripe.com, Linear.app, or Vercel.com.",
          "Return ONLY the raw file content — no JSON, no markdown fences, no explanations.",
          "The output will be saved directly to disk as-is.",
          "",
          "CRITICAL: Read the AGENT.md carefully. It contains a Design System section with concrete CSS patterns.",
          "You MUST use the design tokens from :root (--space-*, --text-*, --shadow-*, --radius-*, --accent-light, --border, --ease-*, --duration-*).",
          "You MUST use the pre-defined animation keyframes (fadeUp, fadeIn, slideInLeft, scaleIn, shimmer, float, gradient).",
          "You MUST use the .reveal class with IntersectionObserver for scroll-triggered animations.",
          "Build what the user described — with real, relevant content specific to this project.",
          "",
          "VISUAL QUALITY REQUIREMENTS (non-negotiable):",
          "- Hero section: min-height 80vh, gradient background with decorative ::before orb, gradient text on h1,",
          "  large CTA button with shadow and hover lift.",
          "- Navigation: position fixed, backdrop-filter blur, border-bottom with var(--border).",
          "- Cards/Features: glass-card effect (backdrop-filter blur, semi-transparent bg, subtle border),",
          "  hover elevation (translateY(-4px) + shadow-xl), staggered animation delays.",
          "- Buttons: rounded (radius-full), gradient background, shadow with accent color, hover scale+lift.",
          "- Sections: generous padding (space-4xl), section-label in uppercase accent, max-width container.",
          "- Typography: use clamp() vars, tight letter-spacing on headings (-0.03em), font-weight 800 for h1.",
          "- Depth: every section should have visual depth — shadows, gradients, border, or blur. No flat designs.",
          "- Footer: multi-column layout, subtle border-top, muted text color.",
          "- Responsive: mobile-first, hamburger menu animates open/close, grid collapses gracefully.",
          "",
          "CODE QUALITY:",
          "- Write COMPLETE code — every section fully implemented with real content.",
          "- HTML: semantic elements, accessibility, Google Fonts Inter link, data-testid attributes.",
          "- CSS: only use var() tokens, never hard-coded px/colors. Use Grid for layouts, Flexbox for components.",
          "- JS: IntersectionObserver for .reveal elements, smooth scrolling, mobile nav toggle, active nav tracking.",
          "- NO inline styles, NO alert(), NO console.log, NO placeholder text, NO lorem ipsum.",
          "",
          "HTML PROTOTYPE RULES (apply whenever the target file is an .html file):",
          "- Output ONLY raw HTML. The first characters must be <!DOCTYPE html> and the file must end with </html>.",
          "- Keep the shared stylesheet and script references intact: ./styles.css and ./script.js.",
          "- Build at least 5 meaningful sections with realistic domain-specific copy, even if the brief is sparse.",
          "- Use lowercase hyphenated ids for sections and ensure every anchor target actually exists.",
          "- Include a strong hero or intro block, clear calls to action, social proof or trust-building content, and a closing CTA.",
          "- Use https://picsum.photos/seed/{unique-name}/{width}/{height} for non-icon imagery when photos help.",
          "- Include a modal, expandable detail, FAQ accordion, or similar surface when the page content supports it.",
          "- Never use lorem ipsum, 'coming soon', or generic placeholder labels.",
          "- Make sure every DOM selector that JavaScript depends on exists in the HTML.",
          "- If you write single-quoted JavaScript strings, escape apostrophes as \\' to avoid broken scripts.",
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
    console.log("GLM-4.5-Air produced no file changes.");
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
