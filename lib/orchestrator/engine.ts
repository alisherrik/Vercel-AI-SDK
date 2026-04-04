import { createId } from "@/lib/planner/brief";
import {
  buildRunSchema,
  type BuildRun,
  type BuildRunCreateRequest,
  type DeploymentRecord,
} from "@/lib/planner/schemas";

import { getGitHubAdapter } from "@/lib/orchestrator/adapters";
import { createAppSpec } from "@/lib/orchestrator/app-spec";
import { createIssueBacklog } from "@/lib/orchestrator/issues";
import { getBuildRun, listBuildRuns, saveBuildRun } from "@/lib/orchestrator/store";
import { renderStarterApp } from "@/lib/orchestrator/templates";

const inFlightRuns = new Set<string>();

export async function createBuildRun(input: BuildRunCreateRequest): Promise<BuildRun> {
  const now = new Date().toISOString();
  const appSpec = createAppSpec(input.brief, input.messages);
  const agentProvider = getGitHubAdapter().agentProvider;
  const generatedApp = renderStarterApp(appSpec, agentProvider);
  const issues = createIssueBacklog(appSpec, agentProvider);
  const run = buildRunSchema.parse({
    id: createId("run"),
    createdAt: now,
    updatedAt: now,
    status: "queued",
    plannerTitle: input.brief.title || appSpec.appName,
    appSpec,
    generatedApp,
    issues,
    issueExecutions: issues.map((issue) => ({
      issueId: issue.id,
      status: "pending",
      branchName: "",
      pullRequestUrl: "",
      log: [],
    })),
    deployment: createDeploymentRecord(),
  });

  await saveBuildRun(run);
  void runBuildPipeline(run.id);
  return run;
}

export async function retryBuildRun(id: string): Promise<BuildRun> {
  const existing = await getBuildRunOrThrow(id);
  const agentProvider = getGitHubAdapter().agentProvider;
  const appSpec = existing.appSpec;
  const regeneratedApp = appSpec ? renderStarterApp(appSpec, agentProvider) : existing.generatedApp;
  const regeneratedIssues = appSpec ? createIssueBacklog(appSpec, agentProvider) : existing.issues;

  if (existing.repo && regeneratedApp) {
    const github = getGitHubAdapter();
    try {
      await github.configureRepositoryAutomation(existing.repo);
    } catch (err) {
      console.warn("[retry] configureRepositoryAutomation failed, continuing:", err);
    }
    await github.pushGeneratedApp(existing.repo, regeneratedApp);
  }

  const retried: BuildRun = {
    ...existing,
    generatedApp: regeneratedApp,
    updatedAt: new Date().toISOString(),
    status: existing.repo ? "repo_provisioned" : "queued",
    error: null,
    issues: regeneratedIssues.map((issue) => ({
      ...issue,
      githubIssueNumber: null,
      status: "pending",
    })),
    issueExecutions: regeneratedIssues.map((issue) => ({
      issueId: issue.id,
      status: "pending",
      branchName: "",
      pullRequestUrl: "",
      conversationUrl: "",
      log: [],
    })),
    pullRequests: [],
    deployment: createDeploymentRecord(),
  };

  await saveBuildRun(retried);
  void runBuildPipeline(id);
  return retried;
}

export async function getBuildRunSnapshot(id: string): Promise<BuildRun | null> {
  return getBuildRun(id);
}

export async function listBuildRunSnapshots(): Promise<BuildRun[]> {
  return listBuildRuns();
}

export async function getBuildRunArtifacts(id: string) {
  const run = await getBuildRunOrThrow(id);

  return {
    id: run.id,
    status: run.status,
    repoUrl: run.finalArtifactUrls?.repoUrl || run.repo?.url || "",
    pagesUrl: run.finalArtifactUrls?.pagesUrl || run.deployment?.url || "",
  };
}

async function runBuildPipeline(id: string): Promise<void> {
  if (inFlightRuns.has(id)) {
    return;
  }

  inFlightRuns.add(id);

  try {
    let run = await getBuildRunOrThrow(id);
    const github = getGitHubAdapter();

    if (!run.appSpec || !run.generatedApp) {
      throw new Error("Build run is missing executable app data.");
    }

    if (!run.repo) {
      const repo = await github.createRepository(run.appSpec.appName);
      // Persist the repo reference immediately so retries don't re-create it.
      run = await patchRun(id, { repo });
      await github.configureRepositoryAutomation(repo);
      await github.pushGeneratedApp(repo, run.generatedApp!);
      await github.ensurePagesSite(repo);
      run = await patchRun(id, {
        status: "repo_provisioned",
      });
    }

    if (run.issues.some((issue) => issue.status === "pending")) {
      const createdIssues = await github.createIssues(run.repo!, run.issues);
      run = await patchRun(id, {
        issues: createdIssues.map((issue) => ({ ...issue, status: "in_progress" })),
        issueExecutions: createdIssues.map((issue) => ({
          issueId: issue.id,
          status: "running",
          branchName: "",
          pullRequestUrl: "",
          conversationUrl: "",
          log: [
            formatIssueCreationLog(github.agentProvider, issue.githubIssueNumber),
          ],
        })),
        status: "issues_created",
      });
    }

    if (run.issues.some((issue) => issue.status === "in_progress")) {
      run = await patchRun(id, {
        status: "executing_issues",
      });

      for (const issue of run.issues) {
        if (issue.status !== "in_progress") {
          continue;
        }

        const result = await github.processIssue(run.repo!, issue);
        const latest = await getBuildRunOrThrow(id);

        run = await patchRun(id, {
          issues: latest.issues.map((currentIssue) =>
            currentIssue.id === issue.id ? result.issue : currentIssue,
          ),
          issueExecutions: latest.issueExecutions.map((execution) =>
            execution.issueId === issue.id ? result.execution : execution,
          ),
          pullRequests: result.pullRequest
            ? [
                ...latest.pullRequests.filter(
                  (pullRequest) => pullRequest.issueId !== issue.id,
                ),
                result.pullRequest,
              ]
            : latest.pullRequests,
        });
      }
    }

    run = await patchRun(id, {
      status: "deploying",
      deployment: {
        provider: "github-pages",
        status: "deploying",
        url: "",
        log: ["Waiting for the direct main-branch publish to reach GitHub Pages."],
      },
    });

    const pagesUrl = await github.waitForPagesDeployment(run.repo!);

    await patchRun(id, {
      status: "completed",
      deployment: {
        provider: "github-pages",
        status: "success",
        url: pagesUrl,
        log: [
          "GitHub Pages deployment reported success.",
          `Published at ${pagesUrl}`,
        ],
      },
      finalArtifactUrls: {
        repoUrl: run.repo!.url,
        pagesUrl,
      },
    });
  } catch (error) {
    const run = await getBuildRun(id);

    if (run) {
      await patchRun(id, {
        status: "failed",
        error:
          error instanceof Error ? error.message : "Build orchestration failed.",
        deployment: run.deployment
          ? {
              ...run.deployment,
              status: "failed",
              log: [
                ...run.deployment.log,
                error instanceof Error
                  ? error.message
                  : "Build orchestration failed.",
              ],
            }
          : createDeploymentRecord("failed"),
      });
    }
  } finally {
    inFlightRuns.delete(id);
  }
}

function formatIssueCreationLog(
  provider: "claude" | "copilot" | "glm",
  issueNumber: number | null,
): string {
  if (provider === "copilot") {
    return `Created GitHub issue #${issueNumber} and assigned it to Copilot coding agent.`;
  }

  if (provider === "glm") {
    return `Created GitHub issue #${issueNumber} and queued it for GLM-4.`;
  }

  return `Created GitHub issue #${issueNumber} and queued it for Claude.`;
}

async function patchRun(id: string, patch: Partial<BuildRun>): Promise<BuildRun> {
  const current = await getBuildRunOrThrow(id);
  const next = buildRunSchema.parse({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await saveBuildRun(next);
  return next;
}

async function getBuildRunOrThrow(id: string): Promise<BuildRun> {
  const run = await getBuildRun(id);

  if (!run) {
    throw new Error(`Build run ${id} was not found.`);
  }

  return run;
}

function createDeploymentRecord(
  status: DeploymentRecord["status"] = "pending",
): DeploymentRecord {
  return {
    provider: "github-pages",
    status,
    url: "",
    log: [],
  };
}
