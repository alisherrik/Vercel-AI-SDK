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
- Persists the active session in `sessionStorage`
- Renders the markdown inline with `Copy` and `Download .md` actions

## Verification

The current implementation passes:

- `npm run lint`
- `npm test`
- `npm run build`
