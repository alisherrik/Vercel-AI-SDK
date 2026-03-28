$ErrorActionPreference = "Stop"

$repo = "alishers-company/claude-launch-pad-20260328"

function Upsert-RepoFile {
  param(
    [string]$Path,
    [string]$Message,
    [string]$Content
  )

  $existing = $null
  try {
    $existing = gh api "repos/$repo/contents/$Path" | ConvertFrom-Json
  } catch {
    $existing = $null
  }

  $body = @{
    message = $Message
    content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Content))
    branch  = "main"
  }

  if ($existing) {
    $body.sha = $existing.sha
  }

  $json = $body | ConvertTo-Json
  $json | gh api "repos/$repo/contents/$Path" --method PUT --input - | Out-Null
}

$openPr = @"
name: Claude Open PR

on:
  issue_comment:
    types: [created, edited]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  open-pr:
    if: github.event.comment.user.login == 'claude[bot]' && contains(github.event.comment.body, 'Create PR')
    runs-on: ubuntu-latest
    steps:
      - name: Open PR from Claude branch
        uses: actions/github-script@v7
        with:
          github-token: `${{ secrets.GITHUB_TOKEN }}
          script: |
            const body = context.payload.comment.body || '';
            const match = body.match(/\[Create PR[^\]]*\]\((https:\/\/github\.com\/${context.repo.owner}\/${context.repo.repo}\/compare\/main\.\.\.([^?\)]+))/);
            if (!match) {
              core.setFailed('Could not find Claude compare link in comment.');
              return;
            }
            const compareUrl = match[1];
            const head = decodeURIComponent(match[2]);
            const issueNumber = context.payload.issue.number;
            const existing = await github.rest.pulls.list({
              owner: context.repo.owner,
              repo: context.repo.repo,
              head: `${context.repo.owner}:${head}`,
              state: 'open',
            });
            if (existing.data.length > 0) {
              core.info(`PR already exists for ${head}: #${existing.data[0].number}`);
              return;
            }
            const issue = await github.rest.issues.get({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: issueNumber,
            });
            const pr = await github.rest.pulls.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              head,
              base: 'main',
              title: `feat: ${issue.data.title} (issue #${issueNumber})`,
              body: `Closes #${issueNumber}\n\nAuto-opened from Claude completion comment.\n\nSource: ${compareUrl}`,
            });
            core.info(`Created PR #${pr.data.number}`);
"@

$autoMerge = @"
name: Claude Auto Merge

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: write
  pull-requests: write

jobs:
  enable-auto-merge:
    if: startsWith(github.head_ref, 'claude/')
    runs-on: ubuntu-latest
    steps:
      - name: Enable auto-merge
        env:
          GH_TOKEN: `${{ secrets.GITHUB_TOKEN }}
        run: gh pr merge `${{ github.event.pull_request.number }} --repo `${{ github.repository }} --squash --auto
"@

Upsert-RepoFile ".github/workflows/claude-open-pr.yml" "feat: auto-open Claude PRs from completion comments" $openPr
Upsert-RepoFile ".github/workflows/claude-auto-merge.yml" "feat: auto-merge Claude PRs after checks" $autoMerge
