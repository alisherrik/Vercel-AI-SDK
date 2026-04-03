import type { AppSpec, GeneratedApp, GeneratedFile } from "@/lib/planner/schemas";

type AgentProvider = "copilot" | "claude" | "glm";

export function renderStarterApp(spec: AppSpec, agentProvider: AgentProvider): GeneratedApp {
  return {
    name: spec.appName,
    starterKind: spec.starterKind,
    files: [
      {
        path: "index.html",
        content: renderHtml(spec),
      },
      {
        path: "styles.css",
        content: renderStyles(spec),
      },
      {
        path: "script.js",
        content: renderScript(spec),
      },
      {
        path: ".nojekyll",
        content: "# Keep Pages from invoking Jekyll.",
      },
      {
        path: ".github/workflows/ci.yml",
        content: renderCiWorkflow(),
      },
      {
        path: ".github/workflows/deploy-pages.yml",
        content: renderDeployWorkflow(),
      },
      ...renderAgentFiles(spec, agentProvider),
      ...renderStarterDataFiles(spec),
    ],
  };
}

export function renderPreviewDocument(spec: AppSpec): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${spec.appName}</title>
    <style>${renderStyles(spec)}</style>
  </head>
  <body data-starter="${spec.starterKind}">
    ${renderBody(spec)}
    <script>${renderScript(spec)}</script>
  </body>
</html>`;
}

function renderHtml(spec: AppSpec): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${spec.appName}</title>
    <meta
      id="meta-description"
      name="description"
      content="${spec.issueInputs.primaryGoal}"
    />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body data-starter="${spec.starterKind}">
    ${renderBody(spec)}
    <script src="./script.js"></script>
  </body>
</html>`;
}

function renderBody(spec: AppSpec): string {
  switch (spec.starterKind) {
    case "dashboard": return renderDashboardBody(spec);
    case "content":   return renderContentBody(spec);
    default:          return renderLandingBody(spec);
  }
}

/* ── Landing page body ── */
function renderLandingBody(spec: AppSpec): string {
  const ctx = spec.briefContext ?? { mainProblem: "", dataAndAuthNeeds: [], integrations: [], visualStyleDirection: [], targetUsers: [], platformExpectations: [] };

  const featureCards = spec.features.slice(0, 6).map((feature, i) => {
    const icons = ["&#10024;", "&#9889;", "&#128640;", "&#128161;", "&#128736;", "&#127919;"];
    return `
      <div class="feature-card">
        <span class="feature-icon">${icons[i % icons.length]}</span>
        <h3>${feature}</h3>
        <p class="feature-desc">Designed for ${spec.issueInputs.audience[i % spec.issueInputs.audience.length] || "your users"}.</p>
      </div>`;
  }).join("");

  const navLinks = spec.pages.map(
    (page) => `<a href="#${toId(page)}" class="nav-link">${page}</a>`
  ).join("");

  const audienceTags = spec.issueInputs.audience.map(
    (a) => `<span class="audience-tag">${a}</span>`
  ).join("");

  const integrationChips = (ctx.integrations ?? []).slice(0, 6).map(
    (item) => `<span class="integration-chip">${item}</span>`
  ).join("");

  const screensRow = spec.issueInputs.coreScreens.slice(0, 4).map((screen) => `
    <div class="screen-card">
      <div class="screen-preview">
        <div class="screen-dots"><span></span><span></span><span></span></div>
        <div class="screen-wireframe">
          <div class="wire-header"></div>
          <div class="wire-row"><div class="wire-block-lg"></div><div class="wire-block-sm"></div></div>
          <div class="wire-row"><div class="wire-block-sm"></div><div class="wire-block-sm"></div><div class="wire-block-sm"></div></div>
        </div>
      </div>
      <p class="screen-name">${screen}</p>
    </div>`).join("");

  return `<div class="app-shell" data-testid="site-shell">
      <header class="app-header">
        <div class="header-brand">
          <div class="brand-mark">${spec.appName.charAt(0)}</div>
          <span class="brand-name">${spec.appName}</span>
        </div>
        <nav class="header-nav" data-testid="primary-nav">${navLinks}</nav>
        <button class="menu-toggle" data-testid="mobile-nav-toggle" aria-expanded="false"><span></span><span></span><span></span></button>
      </header>

      <main>
        <section class="hero-section" id="home" data-testid="hero-section">
          <div class="hero-content">
            <div class="hero-badge">Product</div>
            <h1 class="hero-title" id="page-title">${spec.appName}</h1>
            <p class="hero-subtitle">${spec.issueInputs.primaryGoal}</p>
            <div class="hero-actions">
              <a class="btn-primary" href="#features" data-testid="primary-cta">Get Started</a>
              <button class="btn-secondary" type="button" data-testid="interactive-demo">See Demo</button>
            </div>
          </div>
          <div class="hero-visual">
            <div class="hero-app-preview">
              <div class="hero-app-bar"><span></span><span></span><span></span></div>
              <div class="hero-app-body">
                <div class="hero-app-sidebar">
                  ${spec.pages.slice(0, 5).map((p) => `<div class="hero-nav-item">${p}</div>`).join("")}
                </div>
                <div class="hero-app-content">
                  <div class="wire-block-lg"></div>
                  <div class="wire-row"><div class="wire-block-sm"></div><div class="wire-block-sm"></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="social-proof" id="audience">
          <span class="audience-label">Built for</span>
          ${audienceTags}
        </section>

        ${ctx.mainProblem ? `
        <section class="problem-section" id="problem">
          <div class="section-label">The Problem</div>
          <h2 class="problem-text">${ctx.mainProblem}</h2>
        </section>` : ""}

        <section class="features-section" id="features" data-testid="feature-grid">
          <div class="section-header"><div class="section-label">Features</div><h2 class="section-title">Everything you need</h2></div>
          <div class="features-grid">${featureCards}</div>
        </section>

        ${screensRow ? `
        <section class="screens-section" id="screens">
          <div class="section-header"><div class="section-label">Screens</div><h2 class="section-title">Key Pages</h2></div>
          <div class="screens-showcase">${screensRow}</div>
        </section>` : ""}

        ${integrationChips ? `
        <section class="integrations-section" id="integrations">
          <div class="section-header"><div class="section-label">Integrations</div></div>
          <div class="integration-grid">${integrationChips}</div>
        </section>` : ""}

        <section class="cta-section" id="primary-cta">
          <div class="cta-inner">
            <h2>Ready to build?</h2>
            <p>${spec.copyTone}</p>
            <a class="btn-primary btn-large" href="#home">Get Started Free</a>
          </div>
        </section>
      </main>

      <footer class="app-footer" data-testid="footer-section">
        <div class="footer-brand"><div class="brand-mark brand-mark-sm">${spec.appName.charAt(0)}</div><span class="brand-name">${spec.appName}</span></div>
        <div class="footer-links">${spec.pages.slice(0, 4).map((p) => `<a href="#${toId(p)}">${p}</a>`).join("")}</div>
      </footer>
    </div>`;
}

/* ── Dashboard app body ── */
function renderDashboardBody(spec: AppSpec): string {
  const ctx = spec.briefContext ?? { mainProblem: "", dataAndAuthNeeds: [], integrations: [], visualStyleDirection: [], targetUsers: [], platformExpectations: [] };

  const metricCards = spec.features.slice(0, 4).map((feature, i) => {
    const values = ["2,847", "94.2%", "1,203", "348"];
    const deltas = ["+12.5%", "+3.1%", "-2.4%", "+18.7%"];
    const isPositive = i !== 2;
    return `
      <div class="metric-card">
        <p class="metric-label">${feature}</p>
        <p class="metric-value">${values[i % values.length]}</p>
        <span class="metric-delta ${isPositive ? 'positive' : 'negative'}">${deltas[i % deltas.length]}</span>
      </div>`;
  }).join("");

  const sidebarItems = spec.pages.map((page, i) => `
    <a href="#${toId(page)}" class="sidebar-item ${i === 0 ? 'active' : ''}">
      <span class="sidebar-icon">${["&#9776;", "&#9635;", "&#9783;", "&#9881;", "&#9733;", "&#9673;", "&#128202;", "&#128100;"][i % 8]}</span>
      <span>${page}</span>
    </a>`).join("");

  const tableFeatures = spec.features.slice(0, 5);
  const tableRows = tableFeatures.map((f, i) => {
    const statuses = ["Active", "Pending", "Active", "Review", "Active"];
    const statusClass = statuses[i % statuses.length].toLowerCase();
    return `
      <tr>
        <td><span class="table-name">${f}</span></td>
        <td>${spec.issueInputs.audience[i % spec.issueInputs.audience.length] || "Team"}</td>
        <td><span class="status-badge status-${statusClass}">${statuses[i % statuses.length]}</span></td>
        <td class="table-date">${i + 1}h ago</td>
      </tr>`;
  }).join("");

  const integrationList = (ctx.integrations ?? []).slice(0, 4).map(
    (item) => `<div class="activity-item"><span class="activity-dot"></span><span>${item} connected</span></div>`
  ).join("");

  return `<div class="dash-shell" data-testid="site-shell">
      <aside class="dash-sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark">${spec.appName.charAt(0)}</div>
          <span class="brand-name">${spec.appName}</span>
        </div>
        <nav class="sidebar-nav" data-testid="primary-nav">${sidebarItems}</nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar">${(spec.issueInputs.audience[0] || "U").charAt(0)}</div>
            <div>
              <p class="user-name">${spec.issueInputs.audience[0] || "User"}</p>
              <p class="user-role">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      <div class="dash-main">
        <header class="dash-topbar">
          <button class="menu-toggle" data-testid="mobile-nav-toggle" aria-expanded="false"><span></span><span></span><span></span></button>
          <div>
            <h1 id="page-title" class="dash-page-title">Dashboard</h1>
            <p class="dash-page-desc">${spec.issueInputs.primaryGoal}</p>
          </div>
          <div class="dash-topbar-actions">
            <button class="btn-secondary btn-sm" type="button" data-testid="interactive-demo">Export</button>
            <a class="btn-primary btn-sm" href="#" data-testid="primary-cta">+ New</a>
          </div>
        </header>

        <main class="dash-content" data-testid="hero-section">
          <section class="metrics-grid" data-testid="feature-grid">${metricCards}</section>

          <div class="dash-two-col">
            <section class="dash-card dash-card-wide">
              <div class="card-header">
                <h3>Overview</h3>
                <div class="card-tabs">
                  <button class="card-tab active">Week</button>
                  <button class="card-tab">Month</button>
                  <button class="card-tab">Year</button>
                </div>
              </div>
              <div class="chart-placeholder">
                <svg viewBox="0 0 400 120" class="chart-svg">
                  <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
                  <path d="M0,100 C40,90 80,60 120,65 C160,70 200,30 240,35 C280,40 320,15 360,20 L400,10 L400,120 L0,120Z" fill="url(#cg)"/>
                  <path d="M0,100 C40,90 80,60 120,65 C160,70 200,30 240,35 C280,40 320,15 360,20 L400,10" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
              </div>
            </section>

            <section class="dash-card">
              <div class="card-header"><h3>Activity</h3></div>
              <div class="activity-list">
                ${spec.issueInputs.coreScreens.slice(0, 3).map((s, i) => `
                <div class="activity-item">
                  <span class="activity-dot"></span>
                  <span>${s} updated</span>
                  <span class="activity-time">${i * 2 + 1}m</span>
                </div>`).join("")}
                ${integrationList}
              </div>
            </section>
          </div>

          <section class="dash-card">
            <div class="card-header"><h3>Recent Items</h3><button class="btn-link">View all</button></div>
            <table class="dash-table">
              <thead><tr><th>Name</th><th>Owner</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </section>
        </main>
      </div>
    </div>`;
}

/* ── Content / blog body ── */
function renderContentBody(spec: AppSpec): string {
  const ctx = spec.briefContext ?? { mainProblem: "", dataAndAuthNeeds: [], integrations: [], visualStyleDirection: [], targetUsers: [], platformExpectations: [] };

  const categories = spec.issueInputs.coreScreens.slice(0, 5);
  const categoryTabs = categories.map((c, i) => `<button class="cat-tab ${i === 0 ? "active" : ""}">${c}</button>`).join("");

  const articleCards = spec.features.slice(0, 6).map((feature, i) => {
    const readTimes = ["3 min", "5 min", "8 min", "4 min", "6 min", "2 min"];
    const colors = ["#e8d5c4", "#c4d5e8", "#d5e8c4", "#e8c4d5", "#c4e8d5", "#d5c4e8"];
    return `
      <article class="article-card">
        <div class="article-thumb" style="background:${colors[i % colors.length]}">
          <span class="article-cat">${categories[i % categories.length] || "Guide"}</span>
        </div>
        <div class="article-body">
          <h3 class="article-title">${feature}</h3>
          <p class="article-meta">${readTimes[i % readTimes.length]} read · ${spec.issueInputs.audience[i % spec.issueInputs.audience.length] || "Everyone"}</p>
        </div>
      </article>`;
  }).join("");

  const navLinks = spec.pages.map(
    (page) => `<a href="#${toId(page)}" class="nav-link">${page}</a>`
  ).join("");

  const featuredContent = spec.features[0] || "Getting Started";
  const featuredDesc = ctx.mainProblem || spec.issueInputs.primaryGoal;

  return `<div class="app-shell content-shell" data-testid="site-shell">
      <header class="app-header">
        <div class="header-brand">
          <div class="brand-mark">${spec.appName.charAt(0)}</div>
          <span class="brand-name">${spec.appName}</span>
        </div>
        <nav class="header-nav" data-testid="primary-nav">${navLinks}</nav>
        <div class="header-actions">
          <button class="btn-secondary btn-sm" type="button" data-testid="interactive-demo">Subscribe</button>
          <a class="btn-primary btn-sm" href="#" data-testid="primary-cta">Write</a>
        </div>
        <button class="menu-toggle" data-testid="mobile-nav-toggle" aria-expanded="false"><span></span><span></span><span></span></button>
      </header>

      <main data-testid="hero-section">
        <section class="content-hero" id="home">
          <div class="content-hero-text">
            <div class="hero-badge">Featured</div>
            <h1 id="page-title" class="content-hero-title">${featuredContent}</h1>
            <p class="content-hero-desc">${featuredDesc}</p>
            <div class="content-hero-meta">
              <span class="author-chip">
                <span class="author-avatar">${(spec.issueInputs.audience[0] || "A").charAt(0)}</span>
                ${spec.issueInputs.audience[0] || "Author"}
              </span>
              <span class="meta-sep">&middot;</span>
              <span>8 min read</span>
            </div>
          </div>
          <div class="content-hero-image" style="background: linear-gradient(135deg, ${spec.theme.accent}22, ${spec.theme.accent}44)">
            <div class="hero-image-lines">
              <div class="img-line" style="width:70%"></div>
              <div class="img-line" style="width:50%"></div>
              <div class="img-line" style="width:85%"></div>
              <div class="img-line" style="width:40%"></div>
            </div>
          </div>
        </section>

        <section class="content-categories" data-testid="feature-grid">
          <div class="cat-tabs">${categoryTabs}</div>
        </section>

        <section class="content-grid" id="articles">
          ${articleCards}
        </section>

        ${(ctx.integrations ?? []).length > 0 ? `
        <section class="content-tools">
          <div class="section-label">Powered by</div>
          <div class="tools-row">
            ${(ctx.integrations ?? []).slice(0, 6).map((t) => `<span class="tool-chip">${t}</span>`).join("")}
          </div>
        </section>` : ""}

        <section class="content-newsletter" id="primary-cta">
          <div class="newsletter-inner">
            <h2>Stay in the loop</h2>
            <p>Get the latest from ${spec.appName} delivered to your inbox.</p>
            <div class="newsletter-form">
              <input type="email" placeholder="you@email.com" class="newsletter-input" />
              <button class="btn-primary">Subscribe</button>
            </div>
          </div>
        </section>
      </main>

      <footer class="app-footer" data-testid="footer-section">
        <div class="footer-brand"><div class="brand-mark brand-mark-sm">${spec.appName.charAt(0)}</div><span class="brand-name">${spec.appName}</span></div>
        <div class="footer-links">${spec.pages.slice(0, 4).map((p) => `<a href="#${toId(p)}">${p}</a>`).join("")}</div>
      </footer>
    </div>`;
}

function renderStyles(spec: AppSpec): string {
  const base = renderBaseStyles(spec);
  switch (spec.starterKind) {
    case "dashboard": return base + renderDashboardStyles();
    case "content":   return base + renderContentStyles();
    default:          return base + renderLandingStyles();
  }
}

function renderBaseStyles(spec: AppSpec): string {
  return `:root {
  --bg: ${spec.theme.background};
  --surface: ${spec.theme.surface};
  --accent: ${spec.theme.accent};
  --text: ${spec.theme.text};
  --radius: 14px;
  --radius-lg: 22px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.08);
  --muted: color-mix(in srgb, var(--text) 50%, transparent);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  min-height: 100vh; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6; -webkit-font-smoothing: antialiased;
}
.brand-mark {
  width: 34px; height: 34px; border-radius: 10px; background: var(--accent);
  color: white; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px; flex-shrink: 0;
}
.brand-mark-sm { width: 26px; height: 26px; font-size: 12px; border-radius: 7px; }
.brand-name { font-weight: 600; font-size: 14px; letter-spacing: -0.01em; }
.section-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.13em;
  text-transform: uppercase; color: var(--muted); margin-bottom: 8px;
}
.section-title { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 24px; }
.section-header { margin-bottom: 4px; }
.btn-primary {
  display: inline-flex; align-items: center; padding: 11px 24px; border-radius: 10px;
  background: var(--accent); color: white; font-size: 13px; font-weight: 600;
  text-decoration: none; border: none; cursor: pointer;
  transition: all 0.2s; box-shadow: 0 1px 4px color-mix(in srgb, var(--accent) 25%, transparent);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent); }
.btn-large { padding: 14px 32px; font-size: 15px; border-radius: 12px; }
.btn-secondary {
  display: inline-flex; align-items: center; padding: 11px 24px; border-radius: 10px;
  background: white; color: var(--text); font-size: 13px; font-weight: 600;
  border: 1px solid rgba(0,0,0,0.1); cursor: pointer; transition: all 0.2s;
}
.btn-secondary:hover { border-color: rgba(0,0,0,0.2); transform: translateY(-1px); }
.btn-sm { padding: 7px 16px; font-size: 12px; border-radius: 8px; }
.btn-link { background: none; border: none; color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer; }
.hero-badge {
  display: inline-block; padding: 5px 14px; border-radius: 999px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent);
  margin-bottom: 20px;
}
.menu-toggle {
  display: none; flex-direction: column; gap: 4px; padding: 8px;
  background: none; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; cursor: pointer;
}
.menu-toggle span { display: block; width: 18px; height: 2px; background: var(--text); border-radius: 2px; }
.app-footer {
  margin-top: 40px; padding: 28px 0; border-top: 1px solid rgba(0,0,0,0.06);
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;
}
.footer-brand { display: flex; align-items: center; gap: 10px; }
.footer-links { display: flex; gap: 18px; }
.footer-links a { font-size: 13px; color: var(--muted); text-decoration: none; }
.footer-links a:hover { color: var(--accent); }
@keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
@media (max-width: 860px) {
  .menu-toggle { display: flex; }
}
`;
}

/* ── Landing page styles ── */
function renderLandingStyles(): string {
  return `
.app-shell { width: min(1160px, calc(100% - 36px)); margin: 0 auto; padding: 0 0 40px; }
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 22px; margin: 14px 0;
  background: rgba(255,255,255,0.72); backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-lg);
  position: sticky; top: 14px; z-index: 100;
}
.header-brand { display: flex; align-items: center; gap: 10px; }
.header-nav { display: flex; gap: 2px; }
.nav-link { padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--text); text-decoration: none; transition: 0.15s; }
.nav-link:hover { background: rgba(0,0,0,0.04); }

/* Hero split */
.hero-section {
  display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center;
  margin-top: 8px; padding: 56px 48px; border-radius: var(--radius-lg);
  background: var(--surface); border: 1px solid rgba(0,0,0,0.06);
  position: relative; overflow: hidden;
}
.hero-section::before {
  content: ""; position: absolute; inset: -50%; width: 200%; height: 200%;
  background: radial-gradient(ellipse at 70% 30%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 55%);
  pointer-events: none;
}
.hero-section > * { position: relative; z-index: 1; }
.hero-content { display: flex; flex-direction: column; }
.hero-title {
  font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 800; line-height: 1.08;
  letter-spacing: -0.04em; margin-bottom: 16px;
}
.hero-subtitle { font-size: 1.05rem; color: var(--muted); line-height: 1.7; margin-bottom: 28px; }
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }

/* Mini app preview in hero */
.hero-visual { display: flex; justify-content: center; }
.hero-app-preview {
  width: 100%; max-width: 380px; border-radius: 14px; overflow: hidden;
  border: 1px solid rgba(0,0,0,0.08); box-shadow: var(--shadow-lg);
  background: white;
}
.hero-app-bar {
  display: flex; gap: 5px; padding: 10px 14px;
  background: #f5f5f5; border-bottom: 1px solid rgba(0,0,0,0.06);
}
.hero-app-bar span { width: 8px; height: 8px; border-radius: 50%; }
.hero-app-bar span:nth-child(1) { background: #ff5f57; }
.hero-app-bar span:nth-child(2) { background: #ffbd2e; }
.hero-app-bar span:nth-child(3) { background: #28ca42; }
.hero-app-body { display: flex; min-height: 180px; }
.hero-app-sidebar {
  width: 100px; background: #fafafa; border-right: 1px solid rgba(0,0,0,0.05);
  padding: 10px 8px; display: flex; flex-direction: column; gap: 2px;
}
.hero-nav-item {
  padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: 500;
  color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hero-nav-item:first-child { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); }
.hero-app-content { flex: 1; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.wire-block-lg { height: 50px; border-radius: 8px; background: #f3f3f3; }
.wire-block-sm { height: 35px; border-radius: 8px; background: #f3f3f3; flex: 1; }
.wire-row { display: flex; gap: 8px; }
.wire-header { height: 12px; width: 50%; border-radius: 4px; background: #e8e8e8; }

/* Social proof */
.social-proof {
  display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
  padding: 20px; margin-top: 12px;
}
.audience-label { font-size: 12px; font-weight: 500; color: var(--muted); }
.audience-tag {
  padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 500;
  background: white; border: 1px solid rgba(0,0,0,0.06);
  color: color-mix(in srgb, var(--text) 70%, transparent);
}

/* Problem */
.problem-section {
  margin-top: 16px; padding: 36px; background: var(--surface);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-lg);
}
.problem-text {
  font-size: clamp(1.15rem, 2.2vw, 1.6rem); font-weight: 600; line-height: 1.45;
  letter-spacing: -0.02em; color: color-mix(in srgb, var(--text) 85%, var(--accent));
}

/* Features */
.features-section {
  margin-top: 16px; padding: 36px; background: var(--surface);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-lg);
}
.features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.feature-card {
  padding: 22px; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.04);
  border-radius: var(--radius); transition: 0.25s; animation: fadeUp 0.4s ease backwards;
}
.feature-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: color-mix(in srgb, var(--accent) 18%, transparent); }
.feature-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  font-size: 18px; margin-bottom: 12px;
}
.feature-card h3 { font-size: 14px; font-weight: 600; line-height: 1.4; }
.feature-desc { font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.5; }

/* Screens */
.screens-section {
  margin-top: 16px; padding: 36px; background: var(--surface);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-lg);
}
.screens-showcase { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.screen-card { animation: fadeUp 0.4s ease backwards; }
.screen-preview {
  background: #1a1a2e; border-radius: 12px; padding: 10px;
  box-shadow: var(--shadow-md); overflow: hidden;
}
.screen-dots { display: flex; gap: 5px; margin-bottom: 10px; }
.screen-dots span { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.15); }
.screen-dots span:first-child { background: #ff5f57; }
.screen-dots span:nth-child(2) { background: #ffbd2e; }
.screen-dots span:last-child { background: #28ca42; }
.screen-wireframe { padding: 6px; display: flex; flex-direction: column; gap: 6px; }
.screen-wireframe .wire-header { background: rgba(255,255,255,0.12); }
.screen-wireframe .wire-block-lg { background: rgba(255,255,255,0.06); height: 35px; }
.screen-wireframe .wire-block-sm { background: rgba(255,255,255,0.06); height: 24px; }
.screen-wireframe .wire-row { display: flex; gap: 6px; }
.screen-name { text-align: center; font-size: 12px; font-weight: 600; margin-top: 10px; color: var(--muted); }

/* Integrations */
.integrations-section {
  margin-top: 16px; padding: 36px; background: var(--surface);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-lg);
}
.integration-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.integration-chip {
  padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 500;
  background: white; border: 1px solid rgba(0,0,0,0.06); transition: 0.2s;
}
.integration-chip:hover { border-color: color-mix(in srgb, var(--accent) 25%, transparent); transform: translateY(-1px); }

/* CTA */
.cta-section { margin-top: 16px; }
.cta-inner {
  text-align: center; padding: 56px 36px; border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000));
  color: white; position: relative; overflow: hidden;
}
.cta-inner::before {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.12), transparent 60%);
  pointer-events: none;
}
.cta-inner > * { position: relative; z-index: 1; }
.cta-inner h2 { font-size: clamp(1.4rem, 2.8vw, 2rem); font-weight: 700; letter-spacing: -0.03em; margin-bottom: 10px; }
.cta-inner p { font-size: 14px; opacity: 0.85; margin-bottom: 24px; }
.cta-inner .btn-primary { background: white; color: var(--accent); }

@media (max-width: 860px) {
  .header-nav { display: none; }
  .hero-section { grid-template-columns: 1fr; padding: 40px 28px; }
  .hero-visual { order: -1; }
  .features-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 540px) {
  .features-grid { grid-template-columns: 1fr; }
}
`;
}

/* ── Dashboard styles ── */
function renderDashboardStyles(): string {
  return `
.dash-shell { display: flex; height: 100vh; overflow: hidden; }
.dash-sidebar {
  width: 240px; background: var(--surface); border-right: 1px solid rgba(0,0,0,0.06);
  display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto;
}
.sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 18px 18px 14px; }
.sidebar-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 10px; flex: 1; }
.sidebar-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px;
  font-size: 13px; font-weight: 500; color: var(--muted); text-decoration: none; transition: 0.15s;
}
.sidebar-item:hover { background: rgba(0,0,0,0.04); color: var(--text); }
.sidebar-item.active { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); font-weight: 600; }
.sidebar-icon { font-size: 16px; width: 20px; text-align: center; }
.sidebar-footer { padding: 14px; border-top: 1px solid rgba(0,0,0,0.06); }
.sidebar-user { display: flex; align-items: center; gap: 10px; }
.user-avatar {
  width: 32px; height: 32px; border-radius: 9px; background: var(--accent);
  color: white; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px;
}
.user-name { font-size: 13px; font-weight: 600; }
.user-role { font-size: 11px; color: var(--muted); }

.dash-main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: var(--bg); }
.dash-topbar {
  display: flex; align-items: center; gap: 16px; padding: 18px 28px;
  border-bottom: 1px solid rgba(0,0,0,0.06); background: var(--surface);
  position: sticky; top: 0; z-index: 50;
}
.dash-topbar > .menu-toggle { display: none; }
.dash-page-title { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
.dash-page-desc { font-size: 12px; color: var(--muted); }
.dash-topbar-actions { display: flex; gap: 8px; margin-left: auto; }

.dash-content { padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; }

/* Metrics */
.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.metric-card {
  padding: 20px; background: var(--surface); border: 1px solid rgba(0,0,0,0.05);
  border-radius: var(--radius); transition: 0.2s;
}
.metric-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.metric-label { font-size: 12px; font-weight: 500; color: var(--muted); margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.metric-value { font-size: 1.7rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; margin-bottom: 6px; }
.metric-delta { font-size: 12px; font-weight: 600; border-radius: 6px; padding: 2px 8px; }
.metric-delta.positive { background: #dcfce7; color: #166534; }
.metric-delta.negative { background: #fef2f2; color: #991b1b; }

/* Chart */
.dash-two-col { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
.dash-card {
  background: var(--surface); border: 1px solid rgba(0,0,0,0.05);
  border-radius: var(--radius); padding: 20px; overflow: hidden;
}
.dash-card-wide { }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.card-header h3 { font-size: 14px; font-weight: 700; }
.card-tabs { display: flex; gap: 2px; background: #f3f3f3; border-radius: 8px; padding: 2px; }
.card-tab {
  padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600;
  border: none; background: transparent; color: var(--muted); cursor: pointer;
}
.card-tab.active { background: white; color: var(--text); box-shadow: var(--shadow-sm); }
.chart-placeholder { width: 100%; }
.chart-svg { width: 100%; height: auto; }

/* Activity */
.activity-list { display: flex; flex-direction: column; gap: 12px; }
.activity-item {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: color-mix(in srgb, var(--text) 75%, transparent);
}
.activity-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.activity-time { margin-left: auto; font-size: 11px; color: var(--muted); }

/* Table */
.dash-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dash-table th {
  text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted);
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.dash-table td { padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,0.04); }
.table-name { font-weight: 600; }
.table-date { color: var(--muted); font-size: 12px; }
.status-badge {
  padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
}
.status-active { background: #dcfce7; color: #166534; }
.status-pending { background: #fef3c7; color: #92400e; }
.status-review { background: #dbeafe; color: #1e40af; }

@media (max-width: 860px) {
  .dash-sidebar { display: none; }
  .dash-topbar > .menu-toggle { display: flex; }
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
  .dash-two-col { grid-template-columns: 1fr; }
}
@media (max-width: 540px) {
  .metrics-grid { grid-template-columns: 1fr; }
  .dash-content { padding: 16px; }
}
`;
}

/* ── Content / blog styles ── */
function renderContentStyles(): string {
  return `
.content-shell { width: min(1100px, calc(100% - 36px)); margin: 0 auto; padding: 0 0 40px; }
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 22px; margin: 14px 0;
  background: rgba(255,255,255,0.72); backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-lg);
  position: sticky; top: 14px; z-index: 100;
}
.header-brand { display: flex; align-items: center; gap: 10px; }
.header-nav { display: flex; gap: 2px; }
.header-actions { display: flex; gap: 6px; }
.nav-link { padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--text); text-decoration: none; transition: 0.15s; }
.nav-link:hover { background: rgba(0,0,0,0.04); }

/* Hero */
.content-hero {
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 32px; align-items: center;
  margin-top: 8px; padding: 44px 40px; border-radius: var(--radius-lg);
  background: var(--surface); border: 1px solid rgba(0,0,0,0.06);
}
.content-hero-title {
  font-size: clamp(1.6rem, 3.5vw, 2.6rem); font-weight: 800;
  line-height: 1.12; letter-spacing: -0.035em; margin-bottom: 14px;
}
.content-hero-desc { font-size: 15px; color: var(--muted); line-height: 1.7; margin-bottom: 20px; }
.content-hero-meta { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--muted); }
.author-chip { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
.author-avatar {
  width: 26px; height: 26px; border-radius: 50%; background: var(--accent);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}
.meta-sep { opacity: 0.3; }
.content-hero-image {
  border-radius: 16px; min-height: 200px; display: flex; align-items: center;
  justify-content: center; overflow: hidden;
}
.hero-image-lines { display: flex; flex-direction: column; gap: 12px; width: 60%; padding: 24px 0; }
.img-line { height: 10px; border-radius: 5px; background: rgba(255,255,255,0.45); }

/* Category tabs */
.content-categories { margin-top: 20px; padding: 4px 0; }
.cat-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.cat-tab {
  padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 500;
  background: white; border: 1px solid rgba(0,0,0,0.06);
  color: var(--muted); cursor: pointer; transition: 0.15s;
}
.cat-tab:hover { border-color: rgba(0,0,0,0.12); color: var(--text); }
.cat-tab.active { background: var(--accent); color: white; border-color: var(--accent); }

/* Article grid */
.content-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px;
}
.article-card {
  background: var(--surface); border: 1px solid rgba(0,0,0,0.05);
  border-radius: var(--radius); overflow: hidden; transition: 0.25s;
  animation: fadeUp 0.4s ease backwards;
}
.article-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
.article-thumb {
  height: 140px; display: flex; align-items: flex-end; padding: 12px;
  position: relative;
}
.article-cat {
  padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  background: rgba(255,255,255,0.85); color: var(--text);
}
.article-body { padding: 16px 16px 20px; }
.article-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.35; margin-bottom: 8px; }
.article-meta { font-size: 12px; color: var(--muted); }

/* Tools */
.content-tools { margin-top: 20px; padding: 28px 32px; background: var(--surface); border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-lg); }
.tools-row { display: flex; flex-wrap: wrap; gap: 8px; }
.tool-chip {
  padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 500;
  background: white; border: 1px solid rgba(0,0,0,0.06);
}

/* Newsletter */
.content-newsletter { margin-top: 20px; }
.newsletter-inner {
  text-align: center; padding: 48px 32px; border-radius: var(--radius-lg);
  background: var(--surface); border: 1px solid rgba(0,0,0,0.06);
}
.newsletter-inner h2 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 8px; }
.newsletter-inner p { font-size: 14px; color: var(--muted); margin-bottom: 22px; }
.newsletter-form { display: flex; gap: 8px; justify-content: center; max-width: 400px; margin: 0 auto; }
.newsletter-input {
  flex: 1; padding: 10px 16px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);
  font-size: 13px; outline: none; transition: 0.2s;
}
.newsletter-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent); }

@media (max-width: 860px) {
  .header-nav { display: none; }
  .content-hero { grid-template-columns: 1fr; }
  .content-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 540px) {
  .content-grid { grid-template-columns: 1fr; }
  .newsletter-form { flex-direction: column; }
}
`;
}

function renderScript(spec: AppSpec): string {
  return `const menuButton = document.querySelector('[data-testid="mobile-nav-toggle"]');
const nav = document.querySelector('[data-testid="primary-nav"]');
const demoBtn = document.querySelector('[data-testid="interactive-demo"]');

menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  nav?.classList.toggle('is-open');
  ${spec.starterKind === "dashboard" ? `
  // Toggle sidebar on mobile
  document.querySelector('.dash-sidebar')?.classList.toggle('sidebar-open');` : ""}
});

demoBtn?.addEventListener('click', () => {
  demoBtn.textContent = '${spec.starterKind === "dashboard" ? "Exporting..." : spec.starterKind === "content" ? "Subscribed!" : "Launching..."} \\u2713';
  demoBtn.style.borderColor = 'var(--accent)';
  demoBtn.style.color = 'var(--accent)';
  demoBtn.disabled = true;
});

// Scroll-triggered fade-in
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .screen-card, .article-card, .metric-card, .integration-chip').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(14px)';
  el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
  observer.observe(el);
});

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); nav?.classList.remove('is-open'); }
  });
});

// Tab click interactivity
document.querySelectorAll('.card-tab, .cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    tab.parentElement?.querySelectorAll('.card-tab, .cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// Sidebar nav active state
document.querySelectorAll('.sidebar-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
});
`;
}

function renderCiWorkflow(): string {
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
          test -f index.html
          test -f styles.css
          test -f script.js
      - name: Check linked assets
        run: |
          grep -q 'href="./styles.css"' index.html
          grep -q 'src="./script.js"' index.html
          grep -q 'data-testid="hero-section"' index.html
`;
}

function renderDeployWorkflow(): string {
  return `name: Deploy GitHub Pages

on:
  push:
    branches: ["main"]
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
        with:
          enablement: true
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
          BIGMODEL_MODEL: glm-4-plus
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node .github/scripts/implement-with-glm.mjs
      - name: Commit implementation
        if: steps.implement.outcome == 'success' && steps.implement.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "feat: implement issue #\${{ github.event.issue.number }} with GLM-4"
          git push origin HEAD:\${{ github.event.repository.default_branch }}
      - name: Post completion note
        if: steps.implement.outcome == 'success' && steps.implement.outputs.changed == 'true'
        env:
          GH_TOKEN: \${{ github.token }}
          GLM_SUMMARY: \${{ steps.implement.outputs.summary }}
        run: |
          gh issue comment "\${{ github.event.issue.number }}" \\
            --repo "\${{ github.repository }}" \\
            --body "GLM-4 committed the requested implementation directly to the default branch.

          Summary: \$GLM_SUMMARY"
      - name: Post no-change note
        if: steps.implement.outcome == 'success' && steps.implement.outputs.changed != 'true'
        env:
          GH_TOKEN: \${{ github.token }}
          GLM_SUMMARY: \${{ steps.implement.outputs.summary }}
        run: |
          gh issue comment "\${{ github.event.issue.number }}" \\
            --repo "\${{ github.repository }}" \\
            --body "GLM-4 reviewed the issue but did not produce file changes.

          Summary: \$GLM_SUMMARY"
      - name: Post failure note
        if: steps.implement.outcome != 'success'
        env:
          GH_TOKEN: \${{ github.token }}
          GLM_ERROR: \${{ steps.implement.outputs.error }}
        run: |
          gh issue comment "\${{ github.event.issue.number }}" \\
            --repo "\${{ github.repository }}" \\
            --body "GLM-4 could not complete the implementation run.

          Error: \$GLM_ERROR"
`;
}

function renderAgentInstructions(spec: AppSpec, agentProvider: AgentProvider): string {
  const agentName = agentProvider === "glm" ? "GLM-4" : "Claude";

  return `# ${spec.appName}

Follow the issue scope exactly.

- You are the ${agentName} implementation agent for this repository.
- Build interactive client-side pages that remain GitHub Pages compatible.
- Stay within HTML, CSS, JavaScript, and repo-level config files.
- Commit finished work directly to main for this generated repository.
- Run the listed CI checks when possible before finishing.
- Do not introduce server runtimes or secrets into the generated site.
`;
}

function renderGlmImplementationScript(): string {
  return `import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_MODEL = process.env.BIGMODEL_MODEL || "glm-4-plus";
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
  const allowedFiles = parseBulletedSection(issueBody, "Allowed files:");

  if (!allowedFiles.length) {
    throw new Error("Could not find any allowed files in the issue body.");
  }

  const currentFiles = await Promise.all(
    allowedFiles.map(async (filePath) => ({
      path: filePath,
      content: existsSync(filePath) ? await readFile(filePath, "utf8") : "",
    })),
  );

  const agentInstructions = existsSync("AGENT.md") ? await readFile("AGENT.md", "utf8") : "";
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
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a senior front-end implementation agent working inside GitHub Actions.",
            "Return only JSON with this shape:",
            '{ "summary": "short summary", "files": [{ "path": "file", "contentBase64": "base64 encoded full file contents" }] }',
            "Only return files from the allowed list.",
            "Every returned file must contain the full final file, not a diff.",
            "Use contentBase64 for every file so multiline HTML, CSS, and JavaScript stay valid JSON.",
            "Prioritize rich, interactive client-side pages instead of flat static brochure content.",
            "Do not include markdown fences or commentary.",
          ].join("\\n"),
        },
        {
          role: "user",
          content: [
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
            "Current allowed files:",
            JSON.stringify(currentFiles, null, 2),
          ].join("\\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(\`BigModel request failed (\${response.status}): \${await response.text()}\`);
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;
  const content = normalizeMessageContent(rawContent);

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("BigModel returned an empty message.");
  }

  const result = parseModelJson(content);

  if (!Array.isArray(result.files) || result.files.length === 0) {
    throw new Error("BigModel did not return any files to update.");
  }

  for (const file of result.files) {
    if (!file || typeof file.path !== "string") {
      throw new Error("BigModel returned an invalid file payload.");
    }

    if (!allowedFiles.includes(file.path)) {
      throw new Error(\`Model attempted to edit disallowed file: \${file.path}\`);
    }

    const nextContent = readFileContent(file);
    await writeFile(file.path, nextContent, "utf8");
  }

  const changedFiles = listChangedFiles();

  if (changedFiles.length === 0) {
    console.log("GLM-4 produced no file changes.");
    await appendOutput("changed", "false");
    await appendOutput("summary", typeof result.summary === "string" ? result.summary : "No file changes were produced.");
  } else {
    console.log(\`Updated files: \${changedFiles.join(", ")}\`);
    await appendOutput("changed", "true");
    await appendOutput(
      "summary",
      typeof result.summary === "string" ? result.summary : \`Updated files: \${changedFiles.join(", ")}\`,
    );
  }
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

  console.error("=== JSON PARSE FAILED ===");
  console.error("First 500 chars:", content.slice(0, 500));
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
    .map((line) => line.trim().slice(3))
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

function renderStarterDataFiles(spec: AppSpec): GeneratedFile[] {
  if (spec.starterKind === "dashboard") {
    return [
      {
        path: "assets/metrics.json",
        content: JSON.stringify(
          [
            { label: "Active workflows", value: "18" },
            { label: "Weekly conversions", value: "42%" },
          ],
          null,
          2,
        ),
      },
    ];
  }

  if (spec.starterKind === "content") {
    return [
      {
        path: "assets/articles.json",
        content: JSON.stringify(
          [
            { title: `${spec.appName} launch brief`, category: "Strategy" },
            { title: "Three launch lessons", category: "Execution" },
          ],
          null,
          2,
        ),
      },
    ];
  }

  return [];
}

function toId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
