import { Buffer } from "node:buffer";

import sodium from "libsodium-wrappers";

import { slugify } from "@/lib/planner/brief";
import type {
  GeneratedApp,
  GitHubRepo,
  IssueExecution,
  IssuePlan,
  PullRequestRecord,
} from "@/lib/planner/schemas";

type GitHubOwnerType = "org" | "user";
export type AgentProvider = "copilot" | "claude" | "glm";

type GitHubRepoResponse = {
  owner: { login: string };
  name: string;
  html_url: string;
  default_branch: string;
};

type GitHubIssueResponse = {
  number: number;
  html_url: string;
};

type GitHubIssueCommentResponse = {
  html_url: string;
};

type GitHubPagesResponse = {
  html_url?: string;
};

type GitHubPagesBuildResponse = {
  status?: string;
  error?: { message?: string };
};

type GitHubBranchResponse = {
  commit?: {
    sha?: string;
    html_url?: string;
  };
};

type GitHubActionsSecretKeyResponse = {
  key: string;
  key_id: string;
};

type GitHubRefResponse = {
  object: { sha: string };
};

type GitHubCommitResponse = {
  sha: string;
  tree: { sha: string };
};

type GitHubBlobResponse = {
  sha: string;
};

type GitHubTreeResponse = {
  sha: string;
};

type GitHubNewCommitResponse = {
  sha: string;
};

type GitHubWorkflowRunsResponse = {
  workflow_runs?: Array<{
    id: number;
    created_at?: string;
    html_url?: string;
    status?: string;
    conclusion?: string | null;
    event?: string;
    path?: string;
    display_title?: string;
    head_branch?: string;
  }>;
};

export interface ProcessedIssueResult {
  issue: IssuePlan;
  execution: IssueExecution;
  pullRequest: PullRequestRecord | null;
}

export interface GitHubAdapter {
  readonly mode: "fake" | "real";
  readonly agentProvider: AgentProvider;
  createRepository(name: string): Promise<GitHubRepo>;
  configureRepositoryAutomation(repo: GitHubRepo): Promise<void>;
  pushGeneratedApp(repo: GitHubRepo, app: GeneratedApp): Promise<void>;
  ensurePagesSite(repo: GitHubRepo): Promise<void>;
  createIssues(repo: GitHubRepo, issues: IssuePlan[]): Promise<IssuePlan[]>;
  processIssue(repo: GitHubRepo, issue: IssuePlan): Promise<ProcessedIssueResult>;
  waitForPagesDeployment(repo: GitHubRepo): Promise<string>;
}

export function getGitHubAdapter(): GitHubAdapter {
  if (process.env.ORCHESTRATOR_USE_FAKE?.trim().toLowerCase() === "true") {
    return new FakeGitHubAdapter();
  }

  if (process.env.GITHUB_OWNER && process.env.GITHUB_TOKEN) {
    return new GitHubRestAdapter();
  }

  return new FakeGitHubAdapter();
}

class FakeGitHubAdapter implements GitHubAdapter {
  readonly mode: GitHubAdapter["mode"] = "fake";
  readonly agentProvider: AgentProvider = readAgentProvider();

  async createRepository(name: string): Promise<GitHubRepo> {
    const owner = process.env.GITHUB_OWNER || "internal-operator";
    const repoName = slugify(name);

    return {
      owner,
      name: repoName,
      url: `https://github.com/${owner}/${repoName}`,
      defaultBranch: "main",
    };
  }

  async configureRepositoryAutomation(_repo: GitHubRepo): Promise<void> {
    void _repo;
  }

  async pushGeneratedApp(_repo: GitHubRepo, _app: GeneratedApp): Promise<void> {
    void _repo;
    void _app;
  }

  async ensurePagesSite(_repo: GitHubRepo): Promise<void> {
    void _repo;
  }

  async createIssues(_repo: GitHubRepo, issues: IssuePlan[]): Promise<IssuePlan[]> {
    return issues.map((issue, index) => ({
      ...issue,
      githubIssueNumber: index + 1,
    }));
  }

  async processIssue(
    repo: GitHubRepo,
    issue: IssuePlan,
  ): Promise<ProcessedIssueResult> {
    const issueNumber = issue.githubIssueNumber ?? 0;

    return {
      issue: {
        ...issue,
        status: "completed",
      },
      execution: {
        issueId: issue.id,
        status: "completed",
        branchName: repo.defaultBranch,
        pullRequestUrl: "",
        conversationUrl: `${repo.url}/issues/${issueNumber}`,
        log: [
          `Opened issue #${issueNumber}.`,
          `Triggered ${formatAgentDisplayName(this.agentProvider)} automation from the issue thread.`,
          `Committed the implementation directly to ${repo.defaultBranch}.`,
        ],
      },
      pullRequest: null,
    };
  }

  async waitForPagesDeployment(repo: GitHubRepo): Promise<string> {
    return `https://${repo.owner}.github.io/${repo.name}/`;
  }
}

class GitHubRestAdapter extends FakeGitHubAdapter {
  override readonly mode: GitHubAdapter["mode"] = "real";

  private readonly owner = process.env.GITHUB_OWNER!.trim();
  private readonly ownerType = (process.env.GITHUB_OWNER_TYPE?.trim().toLowerCase() ||
    "") as GitHubOwnerType | "";
  private readonly token = process.env.GITHUB_TOKEN!.trim();
  private readonly apiBaseUrl =
    process.env.GITHUB_API_URL?.trim() || "https://api.github.com";
  private readonly repoPrivate =
    process.env.GITHUB_REPO_PRIVATE?.trim().toLowerCase() === "true";
  private readonly pagesTimeoutMs = readDuration(
    process.env.GITHUB_PAGES_TIMEOUT_MS,
    10 * 60_000,
  );
  private readonly issueTimeoutMs = readDuration(
    process.env.GITHUB_ISSUE_TIMEOUT_MS,
    20 * 60_000,
  );
  private readonly repositoryReadyTimeoutMs = readDuration(
    process.env.GITHUB_REPOSITORY_READY_TIMEOUT_MS,
    45_000,
  );
  private readonly pollIntervalMs = readDuration(
    process.env.GITHUB_POLL_INTERVAL_MS,
    15_000,
  );
  private readonly issueLabels = createIssueLabels();
  override readonly agentProvider = readAgentProvider();
  private readonly copilotAssignee =
    process.env.GITHUB_COPILOT_ASSIGNEE?.trim() || "copilot-swe-agent[bot]";
  private readonly copilotModel = process.env.GITHUB_COPILOT_MODEL?.trim() || "";
  private readonly copilotInstructions =
    process.env.GITHUB_COPILOT_INSTRUCTIONS?.trim() || "";
  private readonly templateOwner =
    process.env.GITHUB_TEMPLATE_OWNER?.trim() || this.owner;
  private readonly templateRepo = process.env.GITHUB_TEMPLATE_REPO?.trim() || "";
  private readonly anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() || "";

  override async createRepository(name: string): Promise<GitHubRepo> {
    const repoName = slugify(name);
    const payload = {
      name: repoName,
      auto_init: !this.templateRepo,
      private: this.repoPrivate,
      description: "Generated by Plan Pilot orchestrator",
    };

    const repo = this.templateRepo
      ? await this.request<GitHubRepoResponse>(
          "POST",
          `/repos/${encodeURIComponent(this.templateOwner)}/${encodeURIComponent(this.templateRepo)}/generate`,
          {
            owner: this.owner,
            name: repoName,
            private: this.repoPrivate,
            include_all_branches: false,
            description: "Generated by Plan Pilot orchestrator",
          },
        )
      : this.ownerType === "user"
        ? await this.request<GitHubRepoResponse>("POST", "/user/repos", payload)
        : await this.createRepositoryWithFallback(payload);

    await this.waitForRepositoryAvailability(repo.owner.login, repo.name);

    return {
      owner: repo.owner.login,
      name: repo.name,
      url: repo.html_url,
      defaultBranch: repo.default_branch || "main",
    };
  }

  override async configureRepositoryAutomation(repo: GitHubRepo): Promise<void> {
    await this.request(
      "PATCH",
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`,
      {
        allow_auto_merge: true,
        delete_branch_on_merge: true,
        allow_squash_merge: true,
        allow_merge_commit: false,
        allow_rebase_merge: false,
        has_issues: true,
      },
    );

    try {
      await this.request(
        "PUT",
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/actions/permissions/workflow`,
        {
          default_workflow_permissions: "write",
          can_approve_pull_request_reviews: true,
        },
      );
    } catch (error) {
      console.warn("[github-actions-permissions]", error);
    }

    if (this.agentProvider === "claude") {
      if (!this.anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY must be set for Claude issue automation.");
      }

      await this.upsertActionsSecret(repo, "ANTHROPIC_API_KEY", this.anthropicApiKey);
    } else if (this.agentProvider === "glm") {
      const bigModelApiKey = process.env.BIGMODEL_API_KEY?.trim() || "";

      if (!bigModelApiKey) {
        throw new Error("BIGMODEL_API_KEY must be set for GLM issue automation.");
      }

      await this.upsertActionsSecret(repo, "BIGMODEL_API_KEY", bigModelApiKey);
    }
  }

  override async pushGeneratedApp(repo: GitHubRepo, app: GeneratedApp): Promise<void> {
    const owner = encodeURIComponent(repo.owner);
    const name = encodeURIComponent(repo.name);
    const branch = repo.defaultBranch;

    // 1. Get the current HEAD ref
    let baseSha: string;
    let baseTreeSha: string;

    try {
      const ref = await this.request<GitHubRefResponse>(
        "GET",
        `/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`,
      );
      baseSha = ref.object.sha;

      const commit = await this.request<GitHubCommitResponse>(
        "GET",
        `/repos/${owner}/${name}/git/commits/${baseSha}`,
      );
      baseTreeSha = commit.tree.sha;
    } catch {
      // Empty repo — no base commit yet; create from scratch
      baseSha = "";
      baseTreeSha = "";
    }

    // 2. Create blobs for all files
    const treeItems: Array<{
      path: string;
      mode: "100644";
      type: "blob";
      sha: string;
    }> = [];

    for (const file of app.files) {
      const blob = await this.request<GitHubBlobResponse>(
        "POST",
        `/repos/${owner}/${name}/git/blobs`,
        {
          content: Buffer.from(file.content, "utf8").toString("base64"),
          encoding: "base64",
        },
      );
      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    // 3. Create a new tree
    const treePayload: { tree: typeof treeItems; base_tree?: string } = {
      tree: treeItems,
    };

    if (baseTreeSha) {
      treePayload.base_tree = baseTreeSha;
    }

    const tree = await this.request<GitHubTreeResponse>(
      "POST",
      `/repos/${owner}/${name}/git/trees`,
      treePayload,
    );

    // 4. Create a new commit
    const commitPayload: { message: string; tree: string; parents?: string[] } = {
      message: `chore: publish ${app.starterKind} starter`,
      tree: tree.sha,
    };

    if (baseSha) {
      commitPayload.parents = [baseSha];
    }

    const newCommit = await this.request<GitHubNewCommitResponse>(
      "POST",
      `/repos/${owner}/${name}/git/commits`,
      commitPayload,
    );

    // 5. Update the branch ref (or create it)
    if (baseSha) {
      await this.request(
        "PATCH",
        `/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(branch)}`,
        { sha: newCommit.sha, force: true },
      );
    } else {
      await this.request(
        "POST",
        `/repos/${owner}/${name}/git/refs`,
        { ref: `refs/heads/${branch}`, sha: newCommit.sha },
      );
    }

    // 6. Wait for GitHub to register any new workflow files
    const hasWorkflow = app.files.some((f) => f.path.startsWith(".github/workflows/"));
    if (hasWorkflow) {
      console.log("[push] Waiting 15s for GitHub to register workflow files…");
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
  }

  override async ensurePagesSite(repo: GitHubRepo): Promise<void> {
    const payload = {
      build_type: "workflow",
      source: {
        branch: repo.defaultBranch,
        path: "/",
      },
    };

    try {
      await this.request(
        "POST",
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pages`,
        payload,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("(409)") && !message.includes("(422)")) {
        console.warn("[github-pages:create]", error);
      }

      try {
        await this.request(
          "PUT",
          `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pages`,
          payload,
        );
      } catch (updateError) {
        console.warn("[github-pages:update]", updateError);
      }
    }
  }

  override async createIssues(repo: GitHubRepo, issues: IssuePlan[]): Promise<IssuePlan[]> {
    const nextIssues: IssuePlan[] = [];

    for (const issue of issues) {
      const created = await this.request<GitHubIssueResponse>(
        "POST",
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/issues`,
        this.agentProvider === "copilot"
          ? {
              title: issue.title,
              body: formatIssueBody(issue),
              labels: this.issueLabels,
              assignees: [this.copilotAssignee],
              agent_assignment: {
                target_repo: `${repo.owner}/${repo.name}`,
                base_branch: repo.defaultBranch,
                custom_instructions: buildCopilotInstructions(
                  this.copilotInstructions,
                  issue,
                ),
                custom_agent: "",
                model: this.copilotModel,
              },
            }
          : {
              title: issue.title,
              body: formatIssueBody(issue),
              labels: this.issueLabels,
            },
      );

      nextIssues.push({
        ...issue,
        githubIssueNumber: created.number,
      });
    }

    return nextIssues;
  }

  override async processIssue(
    repo: GitHubRepo,
    issue: IssuePlan,
  ): Promise<ProcessedIssueResult> {
    if (!issue.githubIssueNumber) {
      throw new Error(`Issue ${issue.id} is missing a GitHub issue number.`);
    }

    if (this.agentProvider === "copilot") {
      return {
        issue: {
          ...issue,
          status: "in_progress",
        },
        execution: {
          issueId: issue.id,
          status: "running",
          branchName: "",
          pullRequestUrl: "",
          conversationUrl: `${repo.url}/issues/${issue.githubIssueNumber}`,
          log: [
            `Created GitHub issue #${issue.githubIssueNumber} and assigned it to Copilot coding agent.`,
          ],
        },
        pullRequest: null,
      };
    }

    const agentProvider = this.agentProvider;
    const issueNumber = issue.githubIssueNumber;
    const issueUrl = `${repo.url}/issues/${issueNumber}`;
    const previousHeadSha = await this.getBranchHeadSha(repo, repo.defaultBranch);
    const requestedAt = new Date().toISOString();
    const comment = await this.request<GitHubIssueCommentResponse>(
      "POST",
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/issues/${issueNumber}/comments`,
      {
        body: buildAgentIssuePrompt(agentProvider, issue),
      },
    );

    const commit = await this.waitForDirectMainCommit(
      repo,
      repo.defaultBranch,
      previousHeadSha,
      issueNumber,
      issue.title,
      requestedAt,
    );

    return {
      issue: {
        ...issue,
        status: "completed",
      },
      execution: {
        issueId: issue.id,
        status: "completed",
        branchName: repo.defaultBranch,
        pullRequestUrl: commit.htmlUrl,
        conversationUrl: comment.html_url || issueUrl,
        log: [
          `Opened GitHub issue #${issueNumber}.`,
          `Posted a ${formatAgentMention(agentProvider)} implementation request.`,
          `${formatAgentDisplayName(agentProvider)} committed ${commit.sha.slice(0, 7)} directly to ${repo.defaultBranch}.`,
        ],
      },
      pullRequest: null,
    };
  }

  override async waitForPagesDeployment(repo: GitHubRepo): Promise<string> {
    const deadline = Date.now() + this.pagesTimeoutMs;

    while (Date.now() < deadline) {
      try {
        const build = await this.request<GitHubPagesBuildResponse>(
          "GET",
          `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pages/builds/latest`,
        );

        if (build.status === "built") {
          const pages = await this.request<GitHubPagesResponse>(
            "GET",
            `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pages`,
          );
          return pages.html_url || `https://${repo.owner}.github.io/${repo.name}/`;
        }

        if (build.status === "errored") {
          throw new Error(
            build.error?.message || "GitHub Pages reported a failed deployment.",
          );
        }
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("/pages/builds/latest failed (404)")
        ) {
          throw error;
        }
      }

      await wait(this.pollIntervalMs);
    }

    const pages = await this.request<GitHubPagesResponse>(
      "GET",
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pages`,
    );

    if (!pages.html_url) {
      throw new Error("GitHub Pages URL is not available yet.");
    }

    return pages.html_url;
  }

  private async waitForDirectMainCommit(
    repo: GitHubRepo,
    branch: string,
    previousHeadSha: string,
    issueNumber: number,
    issueTitle: string,
    requestedAt: string,
  ): Promise<{ sha: string; htmlUrl: string }> {
    const deadline = Date.now() + this.issueTimeoutMs;

    while (Date.now() < deadline) {
      const branchData = await this.request<GitHubBranchResponse>(
        "GET",
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/branches/${encodeURIComponent(branch)}`,
      );

      const nextSha = branchData.commit?.sha;
      const nextUrl = branchData.commit?.html_url;

      if (nextSha && nextSha !== previousHeadSha) {
        return {
          sha: nextSha,
          htmlUrl: nextUrl || `${repo.url}/commit/${nextSha}`,
        };
      }

      const workflowRun = await this.findIssueAutomationRun(
        repo,
        branch,
        issueTitle,
        requestedAt,
      );

      if (workflowRun?.conclusion === "failure") {
        throw new Error(
          `Implementation workflow failed for issue #${issueNumber}: ${workflowRun.html_url || "no run URL available"}`,
        );
      }

      if (workflowRun?.conclusion === "cancelled" || workflowRun?.conclusion === "timed_out") {
        throw new Error(
          `Implementation workflow ended with ${workflowRun.conclusion} for issue #${issueNumber}: ${workflowRun.html_url || "no run URL available"}`,
        );
      }

      if (workflowRun?.conclusion === "success") {
        throw new Error(
          `Implementation workflow finished without committing directly to ${branch} for issue #${issueNumber}: ${workflowRun.html_url || "no run URL available"}`,
        );
      }

      await wait(this.pollIntervalMs);
    }

    throw new Error(
      `${formatAgentDisplayName(this.agentProvider)} did not commit directly to ${branch} for issue #${issueNumber} in time.`,
    );
  }

  private async findIssueAutomationRun(
    repo: GitHubRepo,
    branch: string,
    issueTitle: string,
    requestedAt: string,
  ) {
    const runs = await this.request<GitHubWorkflowRunsResponse>(
      "GET",
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/actions/runs?event=issue_comment&per_page=20`,
    );

    return (runs.workflow_runs || []).find(
      (run) =>
        run.path === ".github/workflows/agent.yml" &&
        run.head_branch === branch &&
        run.display_title === issueTitle &&
        (run.created_at || "") >= requestedAt,
    );
  }

  private async getBranchHeadSha(repo: GitHubRepo, branch: string): Promise<string> {
    const branchData = await this.request<GitHubBranchResponse>(
      "GET",
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/branches/${encodeURIComponent(branch)}`,
    );

    const sha = branchData.commit?.sha;

    if (!sha) {
      throw new Error(`Could not read the head SHA for ${branch}.`);
    }

    return sha;
  }

  private async upsertActionsSecret(
    repo: GitHubRepo,
    secretName: string,
    value: string,
  ): Promise<void> {
    await sodium.ready;
    const publicKey = await this.request<GitHubActionsSecretKeyResponse>(
      "GET",
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/actions/secrets/public-key`,
    );

    const encoded = sealSecret(publicKey.key, value);
    await this.request(
      "PUT",
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/actions/secrets/${encodeURIComponent(secretName)}`,
      {
        encrypted_value: encoded,
        key_id: publicKey.key_id,
      },
    );
  }

  private async createRepositoryWithFallback(
    payload: Record<string, unknown>,
  ): Promise<GitHubRepoResponse> {
    const repoName = payload.name as string;

    // Try org first, then user
    const tryCreate = async (): Promise<GitHubRepoResponse> => {
      try {
        return await this.request<GitHubRepoResponse>(
          "POST",
          `/orgs/${encodeURIComponent(this.owner)}/repos`,
          payload,
        );
      } catch {
        return this.request<GitHubRepoResponse>("POST", "/user/repos", payload);
      }
    };

    try {
      return await tryCreate();
    } catch (error) {
      // If repo already exists (422), fetch and reuse it
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("422") && msg.includes("name already exists")) {
        console.warn(
          `[github-create-repo] "${repoName}" already exists under ${this.owner}, reusing it.`,
        );
        return this.request<GitHubRepoResponse>(
          "GET",
          `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(repoName)}`,
        );
      }
      throw error;
    }
  }

  private async waitForRepositoryAvailability(owner: string, name: string): Promise<void> {
    const pathname = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    const deadline = Date.now() + this.repositoryReadyTimeoutMs;

    while (Date.now() < deadline) {
      const response = await this.rawRequest("GET", pathname);

      if (response.ok) {
        return;
      }

      if (response.status !== 404) {
        const details = await safeReadText(response);
        throw new Error(
          `GitHub API GET ${pathname} failed while waiting for repository readiness (${response.status}): ${details}`,
        );
      }

      await sleep(Math.min(this.pollIntervalMs, 3_000));
    }

    throw new Error(
      `Repository ${owner}/${name} did not become available within ${Math.round(this.repositoryReadyTimeoutMs / 1000)}s.`,
    );
  }

  private async rawRequest(
    method: string,
    pathname: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<Response> {
    return fetch(`${this.apiBaseUrl}${pathname}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "User-Agent": "plan-pilot-orchestrator",
        "X-GitHub-Api-Version": "2022-11-28",
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
  }

  private async request<T>(
    method: string,
    pathname: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const response = await this.rawRequest(method, pathname, body, headers);

    if (!response.ok) {
      const details = await safeReadText(response);
      throw new Error(
        `GitHub API ${method} ${pathname} failed (${response.status}): ${details}`,
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }
}

function createIssueLabels(): string[] {
  const configured = process.env.GITHUB_ISSUE_LABELS?.trim();
  if (!configured) {
    return ["plan-pilot", "backlog"];
  }

  return configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readAgentProvider(): AgentProvider {
  const provider = process.env.GITHUB_AGENT_PROVIDER?.trim().toLowerCase();

  if (provider === "copilot" || provider === "claude" || provider === "glm") {
    return provider;
  }

  return "glm";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatIssueBody(issue: IssuePlan): string {
  return [
    issue.summary,
    "",
    "Allowed files:",
    ...issue.allowedFiles.map((file) => `- ${file}`),
    "",
    "Acceptance criteria:",
    ...issue.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Expected DOM targets:",
    ...(issue.expectedDomTargets.length
      ? issue.expectedDomTargets.map((target) => `- ${target}`)
      : ["- None"]),
    "",
    "CI checks:",
    ...issue.ciChecks.map((check) => `- ${check}`),
    "",
    "Implementation note:",
    "This backlog item was captured for follow-up after the direct-to-main MVP publish.",
  ].join("\n");
}

function buildCopilotInstructions(
  configuredInstructions: string,
  issue: IssuePlan,
): string {
  const parts = [
    configuredInstructions,
    "You are implementing a scoped task inside a generated repository.",
    "Stay within the allowed files and satisfy every acceptance criterion.",
    "Run the listed CI checks when possible before finishing.",
    `Allowed files: ${issue.allowedFiles.join(", ")}`,
    `Acceptance criteria: ${issue.acceptanceCriteria.join(" | ")}`,
  ].filter(Boolean);

  return parts.join("\n");
}

function buildAgentIssuePrompt(
  provider: Exclude<AgentProvider, "copilot">,
  issue: IssuePlan,
): string {
  const mention = formatAgentMention(provider);

  return [
    `${mention} implement this issue and commit the finished changes directly to main.`,
    "Do not create a new branch.",
    "Do not open a pull request.",
    "Stay strictly within the allowed files listed in the issue body.",
    "Satisfy every acceptance criterion before you finish.",
    "Run the listed CI checks when possible before committing.",
    "Build interactive client-side pages that stay GitHub Pages compatible.",
    ...(provider === "glm" ? ["Read AGENT.md before touching files."] : []),
    `Allowed files: ${issue.allowedFiles.join(", ")}`,
  ].join("\n");
}

function formatAgentDisplayName(provider: AgentProvider): string {
  switch (provider) {
    case "copilot":
      return "Copilot coding agent";
    case "glm":
      return "GLM-4";
    default:
      return "Claude";
  }
}

function formatAgentMention(provider: Exclude<AgentProvider, "copilot">): "@claude" | "@glm" {
  return provider === "glm" ? "@glm" : "@claude";
}

function sealSecret(publicKey: string, value: string): string {
  const publicKeyBytes = Buffer.from(publicKey, "base64");
  const encryptedBytes = sodium.crypto_box_seal(
    Buffer.from(value),
    publicKeyBytes,
  );
  return Buffer.from(encryptedBytes).toString("base64");
}

function encodePath(filePath: string): string {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function readDuration(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "No error details returned.";
  }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
