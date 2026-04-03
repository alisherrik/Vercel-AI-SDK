#!/usr/bin/env node
/**
 * implement-with-glm.mjs
 *
 * Called by the agent.yml workflow. Sends the GitHub issue to GLM-4,
 * parses the JSON response, writes files to disk, and sets outputs.
 *
 * Required env vars: GLM_API_KEY, ISSUE_TITLE, ISSUE_BODY, GITHUB_OUTPUT
 */

import { execSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ────────────────────────────────────────────────────────────────────────────
// Load .env file (if it exists in the repo root)
// ────────────────────────────────────────────────────────────────────────────

function loadEnvFile() {
  // Try .env.glm first (committed to repo), then .env as fallback
  for (const name of [".env.glm", ".env"]) {
    const envPath = resolve(process.cwd(), name);
    if (!existsSync(envPath)) continue;
    console.log(`Loading env from ${name}`);
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      // Don't overwrite existing env vars (secrets take priority)
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
    break; // load only the first found
  }
}

loadEnvFile();

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const API_KEY = process.env.BIGMODEL_API_KEY;
if (!API_KEY) {
  console.error("ERROR: BIGMODEL_API_KEY not found.");
  console.error("Set it as a GitHub Secret or put it in the .env file.");
  process.exit(1);
}

const GLM_URL = process.env.BIGMODEL_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_MODEL = process.env.BIGMODEL_MODEL || "glm-4-plus";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Write a key=value pair to $GITHUB_OUTPUT so the workflow can read it. */
function setOutput(key, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    // Use multiline-safe delimiter for values that may contain newlines
    const safeVal = String(value).replaceAll("\n", " ").trim();
    appendFileSync(out, `${key}=${safeVal}\n`, "utf-8");
  }
}

/** Get a filtered tree of files in the repo for GLM context. */
function repoTree() {
  try {
    const raw = execSync("find . -type f -not -path './.git/*'", {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });
    const skip = [
      "./node_modules/",
      "./.next/",
      "./.data/",
      "./claude-run-logs",
      "./.tmp-run-",
    ];
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !skip.some((p) => l.startsWith(p)))
      .join("\n");
  } catch {
    return "";
  }
}

/** Read a file's content, return empty string on failure. */
function safeRead(filePath) {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Robust JSON parser for LLM output
// ────────────────────────────────────────────────────────────────────────────

function parseModelJson(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("parseModelJson: empty or non-string input");
  }

  // 1) Strip markdown ```json ... ``` fences
  function stripFences(t) {
    let s = t.trim();
    s = s.replace(/^```(?:json|jsonc)?\s*/i, "");
    s = s.replace(/\s*```\s*$/, "");
    return s.trim();
  }

  // 2) Fix literal newlines/tabs/CR inside JSON string values
  function fixStrings(t) {
    const out = [];
    let inStr = false;
    let esc = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (esc) { out.push(c); esc = false; continue; }
      if (c === "\\" && inStr) { out.push(c); esc = true; continue; }
      if (c === '"') { inStr = !inStr; out.push(c); continue; }
      if (inStr) {
        if (c === "\n") { out.push("\\n"); continue; }
        if (c === "\r") { out.push("\\r"); continue; }
        if (c === "\t") { out.push("\\t"); continue; }
      }
      out.push(c);
    }
    return out.join("");
  }

  // 3) Remove trailing commas before } or ]
  function stripCommas(t) {
    return t.replace(/,\s*([}\]])/g, "$1");
  }

  // Attempt parse with progressive fixes
  function attempt(t) {
    try { return JSON.parse(t); } catch { /* next */ }
    const fixed = stripCommas(fixStrings(t));
    try { return JSON.parse(fixed); } catch { /* next */ }
    return undefined;
  }

  // Main flow
  const stripped = stripFences(raw);
  const r1 = attempt(stripped);
  if (r1 !== undefined) return r1;

  // 4) Fallback: extract first { … } from raw text
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    const r2 = attempt(m[0]);
    if (r2 !== undefined) return r2;
  }

  // 5) All strategies failed
  console.error("=== ALL JSON PARSE ATTEMPTS FAILED ===");
  console.error("First 500 chars:", raw.slice(0, 500));
  throw new Error("Could not parse GLM response as valid JSON.");
}

// ────────────────────────────────────────────────────────────────────────────
// Build the prompt
// ────────────────────────────────────────────────────────────────────────────

function buildPrompt() {
  const title = process.env.ISSUE_TITLE || "";
  const body = process.env.ISSUE_BODY || "";
  const tree = repoTree();

  return `You are an expert software developer. Analyze the GitHub issue below and produce ONLY a JSON object (no other text) with these keys:

1. "files" — array of objects, each with:
   - "path": relative file path (e.g. "index.html")
   - "content": the COMPLETE new content for that file
2. "summary" — one-line description of what you changed

Rules:
- Return ONLY valid JSON. No markdown, no explanation.
- Each file content must be the FULL file, not a diff.
- Only include files that need to be created or modified.

=== ISSUE TITLE ===
${title}

=== ISSUE BODY ===
${body}

=== REPO FILE TREE ===
${tree}
`;
}

// ────────────────────────────────────────────────────────────────────────────
// Call GLM-4 API
// ────────────────────────────────────────────────────────────────────────────

async function callGLM(prompt) {
  console.log(">>> Calling GLM-4 API...");

  const res = await fetch(GLM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      temperature: 0.15,
      messages: [
        {
          role: "system",
          content:
            "You are an expert developer. Return ONLY valid JSON with keys 'files' and 'summary'. No markdown fences, no extra text.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GLM API HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  let content = data?.choices?.[0]?.message?.content;

  // GLM sometimes returns an array of content blocks
  if (Array.isArray(content)) {
    content = content
      .map((c) => (typeof c === "object" ? c.text || "" : String(c)))
      .join("");
  }

  if (!content) {
    throw new Error("GLM returned empty content.");
  }

  console.log(`<<< Received ${content.length} chars from GLM.`);
  return content;
}

// ────────────────────────────────────────────────────────────────────────────
// Write files to disk
// ────────────────────────────────────────────────────────────────────────────

function writeFiles(parsed) {
  const files = parsed.files || [];
  if (!Array.isArray(files) || files.length === 0) {
    console.log("GLM returned no files to write.");
    return false;
  }

  for (const f of files) {
    if (!f.path || typeof f.content !== "string") {
      console.warn(`Skipping invalid file entry: ${JSON.stringify(f).slice(0, 100)}`);
      continue;
    }

    // Security: block path traversal
    if (f.path.includes("..") || f.path.startsWith("/")) {
      console.warn(`Skipping unsafe path: ${f.path}`);
      continue;
    }

    const dir = dirname(f.path);
    if (dir && dir !== ".") {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(f.path, f.content, "utf-8");
    console.log(`  ✓ ${f.path}`);
  }

  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const prompt = buildPrompt();
  const rawResponse = await callGLM(prompt);
  const parsed = parseModelJson(rawResponse);

  // Validate shape
  if (!parsed || typeof parsed !== "object") throw new Error("Result is not an object");
  if (!Array.isArray(parsed.files)) throw new Error('"files" is not an array');
  if (typeof parsed.summary !== "string") throw new Error('"summary" is not a string');

  const wrote = writeFiles(parsed);
  const summary = parsed.summary || "automated fix";

  setOutput("summary", summary);
  setOutput("has_changes", wrote ? "true" : "false");

  console.log(`\nDone. Summary: ${summary}`);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  setOutput("has_changes", "false");
  process.exit(1);
});
