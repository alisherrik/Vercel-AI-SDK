$ErrorActionPreference = 'Stop'
$repo = 'alishers-company/claude-launch-pad-20260328'
$issueNumbers = 2..6

function Get-IssueTitle($number) {
  gh issue view $number --repo $repo --json title | ConvertFrom-Json | Select-Object -ExpandProperty title
}

function Wait-ClaudeRun($title) {
  for ($i = 0; $i -lt 80; $i++) {
    $runs = gh run list --repo $repo --workflow 'Claude Code' --limit 10 --json databaseId,displayTitle,status,conclusion,url | ConvertFrom-Json
    $run = $runs | Where-Object { $_.displayTitle -eq $title -and ($_.status -eq 'queued' -or $_.status -eq 'in_progress') } | Select-Object -First 1
    if ($run) { return $run }
    Start-Sleep -Seconds 5
  }
  throw "No Claude run started for '$title'"
}

function Wait-RunComplete($runId) {
  gh run watch $runId --repo $repo --exit-status | Out-Null
}

function Get-ClaudeBranch($number) {
  $comments = gh api repos/$repo/issues/$number/comments | ConvertFrom-Json
  $claudeComment = $comments | Where-Object { $_.body -like '*Create PR*' } | Select-Object -Last 1
  if (-not $claudeComment) { throw "No Claude completion comment found for issue #$number" }
  if ($claudeComment.body -match '`([^`]+)`') { return $matches[1] }
  throw "No branch found in Claude comment for issue #$number"
}

function Ensure-Pr($number, $title, $branch) {
  $existing = gh pr list --repo $repo --state all --search "head:$branch" --json number,url,state | ConvertFrom-Json
  if ($existing -and $existing.Count -gt 0) { return $existing[0].number }
  $prUrl = gh pr create --repo $repo --base main --head $branch --title "feat: $title (issue #$number)" --body "Closes #$number`n`nGenerated with Claude Code."
  if ($prUrl -match '/pull/(\d+)$') { return [int]$matches[1] }
  throw "Could not create PR for issue #$number"
}

function Merge-Pr($prNumber) {
  gh pr merge $prNumber --repo $repo --squash --auto | Out-Null
  for ($i = 0; $i -lt 120; $i++) {
    $pr = gh pr view $prNumber --repo $repo --json state | ConvertFrom-Json
    if ($pr.state -eq 'MERGED') { return }
    Start-Sleep -Seconds 5
  }
  throw "PR #$prNumber did not merge in time"
}

foreach ($number in $issueNumbers) {
  $title = Get-IssueTitle $number
  gh issue comment $number --repo $repo --body "@claude implement this issue now, open a PR-ready branch, and stay within the allowed files." | Out-Null
  $run = Wait-ClaudeRun $title
  Wait-RunComplete $run.databaseId
  $branch = Get-ClaudeBranch $number
  $prNumber = Ensure-Pr $number $title $branch
  Merge-Pr $prNumber
  Write-Output "ISSUE $number DONE VIA PR #$prNumber ($branch)"
}
