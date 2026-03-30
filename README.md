# Plan Generation Chat

A Next.js App Router MVP for founder interviews. Users describe the app they want to build, the assistant asks focused follow-up questions with exactly 3 clickable options plus free text, and the app exports one polished markdown handoff for vibe-coding tools.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Vercel AI SDK 6
- Zod
- Vitest + Testing Library

## Run Locally

1. Copy `.env.example` to `.env.local`
2. Configure one provider:
   - `AI_PROVIDER=openai` with `OPENAI_API_KEY`
   - `AI_PROVIDER=openrouter` with `OPENROUTER_API_KEY`
   - or `AI_PROVIDER=gateway` with `AI_GATEWAY_API_KEY`
3. Start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Environment Variables

### OpenAI direct

```bash
AI_PROVIDER=openai
AI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=your_key_here
```

### BigModel / GLM-4

BigModel exposes an OpenAI-compatible chat completions API, so the planner can use it through the existing `openai` provider:

```bash
AI_PROVIDER=openai
AI_MODEL=glm-4-plus
OPENAI_API_KEY=your_bigmodel_key_here
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

### OpenRouter

```bash
AI_PROVIDER=openrouter
AI_MODEL=openrouter/free
OPENROUTER_API_KEY=your_key_here
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_X_TITLE=Plan Generation Chat
```

You can also keep an older OpenAI-compatible setup with:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_openrouter_key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
```

The app now auto-detects `openrouter.ai` in `OPENAI_BASE_URL` and switches to the OpenRouter provider internally.

### Vercel AI Gateway

```bash
AI_PROVIDER=gateway
AI_MODEL=openai/gpt-5.4-mini
AI_GATEWAY_API_KEY=your_key_here
```

## What The App Does

- Starts with a founder prompt and example answer chips
- Maintains a normalized `ProjectBrief` while the chat continues
- Uses `POST /api/planner/turn` for structured follow-up questions
- Uses `POST /api/planner/generate` for the final markdown artifact
- Uses `POST /api/build-runs` plus related status routes for repo/build orchestration
- Persists the active session in `sessionStorage`
- Renders the markdown inline with `Copy` and `Download .md` actions
- Can launch a planner-to-production build run that creates an `AppSpec`, starter files, fixed issue backlog, and a GitHub Pages deployment record
- Can provision a GitHub repo from a template, open implementation issues, trigger an implementation agent on each issue, and wait for GitHub Pages

## Orchestrator Configuration

By default the build-run flow uses local fake adapters so you can test the full UI without touching GitHub.

To enable real GitHub integration, set:

```bash
GITHUB_OWNER=your-org-or-user
GITHUB_OWNER_TYPE=org
GITHUB_TOKEN=your_token
```

Optional overrides:

```bash
GITHUB_API_URL=https://api.github.com
GITHUB_AGENT_PROVIDER=glm
GITHUB_REPO_PRIVATE=false
GITHUB_TEMPLATE_OWNER=your-org-or-user
GITHUB_TEMPLATE_REPO=your-template-repo
GITHUB_PR_MERGE_METHOD=squash
GITHUB_ISSUE_LABELS=plan-pilot,glm-agent
GITHUB_COPILOT_ASSIGNEE=copilot-swe-agent[bot]
GITHUB_COPILOT_APP_SLUG=copilot-swe-agent
GITHUB_COPILOT_BYPASS_ACTOR_ID=
GITHUB_COPILOT_MODEL=
GITHUB_COPILOT_INSTRUCTIONS=
BIGMODEL_API_KEY=your_bigmodel_key_here
```

The real agent flow now supports three modes:

- `GITHUB_AGENT_PROVIDER=glm`
  Generated repos receive a custom GitHub Actions workflow that listens for `@glm`, sends the issue scope plus allowed-file contents to BigModel's `glm-4-plus` chat completions API, writes the returned static files, and commits directly to the default branch. This requires `BIGMODEL_API_KEY`.

- `GITHUB_AGENT_PROVIDER=claude`
  The generated repo receives a Claude GitHub Actions workflow plus `ANTHROPIC_API_KEY`, and each issue gets an automated `@claude` kickoff comment.
- `GITHUB_AGENT_PROVIDER=copilot`
  Each generated issue is created with `assignees: ["copilot-swe-agent[bot]"]`, `agent_assignment.target_repo`, `agent_assignment.base_branch`, and optional custom instructions/model.

If `GITHUB_TEMPLATE_REPO` is configured, the repo is created from that GitHub template before the generated starter app and automation files are pushed.

When a new generated repository is provisioned, the orchestrator also attempts to:

- enable repository auto-merge
- delete branches after merge
- keep squash merge enabled
- configure GitHub Actions workflow permissions for PR automation
- add Copilot integration to repository ruleset bypass lists when the ruleset lives on the repository itself

If a blocking ruleset comes from a parent source, the orchestrator now reports that explicitly. In that case the bypass must be configured at the owner level, not inside the generated repository.

### Planner Model Stays Separate

If you want the planner to keep using its current provider, keep the planner env vars as-is:

```bash
AI_PROVIDER=...
AI_MODEL=...
```

This app does not reuse the planner provider for GitHub issue automation. They are intentionally separate concerns:

- planner uses `AI_PROVIDER` / `AI_MODEL`
- GitHub automation uses GLM (`BIGMODEL_API_KEY`), Claude (`ANTHROPIC_API_KEY`), or Copilot (`GITHUB_AGENT_PROVIDER=copilot`)

## Verification

The current implementation passes:

- `npm run lint`
- `npm test`
- `npm run build`
