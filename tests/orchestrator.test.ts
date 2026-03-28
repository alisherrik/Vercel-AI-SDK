import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createBuildRun,
  getBuildRunSnapshot,
  retryBuildRun,
} from "@/lib/orchestrator/engine";
import { type BuildRunCreateRequest } from "@/lib/planner/schemas";

const request: BuildRunCreateRequest = {
  brief: {
    title: "Invoice Sprint",
    language: "English",
    appGoal: "Help freelancers send invoices faster.",
    targetUsers: ["Freelancers"],
    mainProblem: "Manual invoicing takes too much time.",
    mustHaveFeatures: ["Invoice creation", "Reminder automation"],
    keyScreens: ["Dashboard", "Invoice builder"],
    platformExpectations: ["Responsive web app"],
    dataAndAuthNeeds: ["Email login"],
    integrations: ["Stripe"],
    visualStyleDirection: ["Warm editorial minimalism"],
    technicalNotes: [],
    assumptions: [],
  },
  messages: [
    {
      role: "user",
      content: "I need a static app for freelancers to manage invoices.",
    },
  ],
};

describe("orchestrator engine", () => {
  const originalGitHubOwner = process.env.GITHUB_OWNER;
  const originalGitHubToken = process.env.GITHUB_TOKEN;
  const originalGitHubOwnerType = process.env.GITHUB_OWNER_TYPE;
  const originalOrchestratorUseFake = process.env.ORCHESTRATOR_USE_FAKE;

  beforeEach(() => {
    const storePath = path.join(process.cwd(), ".data", "build-runs.json");
    if (fs.existsSync(storePath)) {
      fs.rmSync(storePath, { force: true });
    }

    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_OWNER_TYPE;
    process.env.ORCHESTRATOR_USE_FAKE = "true";
  });

  afterEach(() => {
    process.env.GITHUB_OWNER = originalGitHubOwner;
    process.env.GITHUB_TOKEN = originalGitHubToken;
    process.env.GITHUB_OWNER_TYPE = originalGitHubOwnerType;
    process.env.ORCHESTRATOR_USE_FAKE = originalOrchestratorUseFake;
  });

  it("creates a run and eventually completes it", async () => {
    const run = await createBuildRun(request);
    expect(run.appSpec?.appName).toBe("Invoice Sprint");

    const snapshot = await waitForRun(run.id, "completed");

    expect(snapshot?.status).toBe("completed");
    expect(snapshot?.deployment?.url).toContain("github.io");
    expect(snapshot?.issues.every((issue) => issue.status === "completed")).toBe(
      true,
    );
    expect(snapshot?.pullRequests).toEqual([]);
    expect(snapshot?.issueExecutions.every((execution) => execution.branchName === "main")).toBe(
      true,
    );
  });

  it("retries a stored run without throwing", async () => {
    const run = await createBuildRun(request);
    await waitForRun(run.id);

    const retried = await retryBuildRun(run.id);
    expect(retried.id).toBe(run.id);
  });
});

async function waitForRun(
  id: string,
  status?: "completed",
): Promise<Awaited<ReturnType<typeof getBuildRunSnapshot>>> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const snapshot = await getBuildRunSnapshot(id);
    if (snapshot && (!status || snapshot.status === status)) {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return getBuildRunSnapshot(id);
}
