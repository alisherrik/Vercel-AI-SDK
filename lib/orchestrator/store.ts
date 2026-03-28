import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildRunSchema, type BuildRun } from "@/lib/planner/schemas";

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "build-runs.json");

export async function listBuildRuns(): Promise<BuildRun[]> {
  const payload = await readStore();
  return payload.runs.map((run) => buildRunSchema.parse(run));
}

export async function getBuildRun(id: string): Promise<BuildRun | null> {
  const runs = await listBuildRuns();
  return runs.find((run) => run.id === id) ?? null;
}

export async function saveBuildRun(run: BuildRun): Promise<void> {
  const payload = await readStore();
  const nextRuns = payload.runs.filter((current) => current.id !== run.id);
  nextRuns.push(run);
  await writeStore({ runs: nextRuns });
}

async function readStore(): Promise<{ runs: BuildRun[] }> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { runs?: BuildRun[] };
    return { runs: parsed.runs ?? [] };
  } catch {
    return { runs: [] };
  }
}

async function writeStore(payload: { runs: BuildRun[] }): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}
