"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { BuildRun } from "@/lib/planner/schemas";

const POLL_INTERVAL = 4_000;

type StatusColor = "bg-gray-400" | "bg-blue-500" | "bg-yellow-500" | "bg-green-500" | "bg-red-500";

function statusColor(status: string): StatusColor {
  switch (status) {
    case "completed":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "queued":
    case "spec_ready":
      return "bg-gray-400";
    case "deploying":
      return "bg-yellow-500";
    default:
      return "bg-blue-500";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function AdminDashboard() {
  const [runs, setRuns] = useState<BuildRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const response = await fetch("/api/build-runs", { cache: "no-store" });
      if (!response.ok) return;
      const data: BuildRun[] = await response.json();
      // Sort newest first.
      data.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setRuns(data);
    } catch {
      // Silently ignore fetch errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    intervalRef.current = setInterval(fetchRuns, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchRuns]);

  const hasActiveRuns = runs.some(
    (r) => !["completed", "failed"].includes(r.status),
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-[family-name:var(--font-manrope)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold">
              P
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              Pipeline Admin
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {hasActiveRuns && (
              <span className="flex items-center gap-2 text-sm text-yellow-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-400" />
                </span>
                Pipelines active
              </span>
            )}
            <Link
              href="/"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Planner
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Summary */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Runs"
            value={runs.length}
          />
          <StatCard
            label="Active"
            value={
              runs.filter(
                (r) => !["completed", "failed"].includes(r.status),
              ).length
            }
            accent="text-blue-400"
          />
          <StatCard
            label="Completed"
            value={runs.filter((r) => r.status === "completed").length}
            accent="text-green-400"
          />
          <StatCard
            label="Failed"
            value={runs.filter((r) => r.status === "failed").length}
            accent="text-red-400"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : runs.length === 0 ? (
          <div className="py-32 text-center text-white/40">
            <p className="text-lg">No build runs yet.</p>
            <p className="mt-1 text-sm">
              Start a build from the{" "}
              <Link href="/" className="underline hover:text-white">
                Planner
              </Link>{" "}
              to see pipelines here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <BuildRunCard
                key={run.id}
                run={run}
                expanded={expandedRun === run.id}
                onToggle={() =>
                  setExpandedRun((prev) =>
                    prev === run.id ? null : run.id,
                  )
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-white/50 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function BuildRunCard({
  run,
  expanded,
  onToggle,
}: {
  run: BuildRun;
  expanded: boolean;
  onToggle: () => void;
}) {
  const repoUrl = run.repo?.url ?? null;
  const pagesUrl =
    run.finalArtifactUrls?.pagesUrl || run.deployment?.url || null;
  const issueCount = run.issues.length;
  const completedIssues = run.issues.filter(
    (i) => i.status === "completed" || i.status === "merged",
  ).length;
  const failedIssues = run.issues.filter(
    (i) => i.status === "failed",
  ).length;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] transition hover:border-white/20">
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span
          className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${statusColor(run.status)}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">
              {run.plannerTitle || run.appSpec?.appName || run.id}
            </span>
            <span className="flex-shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-mono text-white/60">
              {statusLabel(run.status)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
            <span>{timeAgo(run.updatedAt)}</span>
            <span>
              {completedIssues}/{issueCount} pages
              {failedIssues > 0 && (
                <span className="text-red-400"> ({failedIssues} failed)</span>
              )}
            </span>
            {repoUrl && (
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline hover:text-white"
              >
                repo
              </a>
            )}
            {pagesUrl && (
              <a
                href={pagesUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline text-green-400 hover:text-green-300"
              >
                live site
              </a>
            )}
          </div>
        </div>

        <svg
          className={`h-4 w-4 flex-shrink-0 text-white/40 transition ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4">
          {/* Pipeline progress bar */}
          {issueCount > 0 && (
            <div className="mb-5">
              <div className="mb-2 flex justify-between text-xs text-white/50">
                <span>Pipeline Progress</span>
                <span>
                  {completedIssues}/{issueCount} completed
                </span>
              </div>
              <div className="flex gap-1">
                {run.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`h-2 flex-1 rounded-full ${
                      issue.status === "completed" || issue.status === "merged"
                        ? "bg-green-500"
                        : issue.status === "failed"
                          ? "bg-red-500"
                          : issue.status === "in_progress"
                            ? "bg-blue-500 animate-pulse"
                            : "bg-white/10"
                    }`}
                    title={`${issue.title} — ${issue.status}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Issue execution table */}
          <div className="space-y-2">
            {run.issues.map((issue) => {
              const execution = run.issueExecutions.find(
                (e) => e.issueId === issue.id,
              );
              return (
                <div
                  key={issue.id}
                  className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
                >
                  <span
                    className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${statusColor(issue.status)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {issue.title}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {statusLabel(issue.status)}
                      {issue.githubIssueNumber != null && (
                        <> &middot; Issue #{issue.githubIssueNumber}</>
                      )}
                    </p>
                    {execution && execution.log.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {execution.log.map((entry, idx) => (
                          <p
                            key={idx}
                            className="text-xs text-white/30 font-mono"
                          >
                            {entry}
                          </p>
                        ))}
                      </div>
                    )}
                    {execution?.conversationUrl && (
                      <a
                        href={execution.conversationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-violet-400 underline hover:text-violet-300"
                      >
                        View agent conversation
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deployment section */}
          {run.deployment && (
            <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${statusColor(run.deployment.status === "success" ? "completed" : run.deployment.status)}`}
                />
                <span className="text-sm font-medium">
                  GitHub Pages Deployment
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-mono text-white/60">
                  {statusLabel(run.deployment.status)}
                </span>
              </div>
              {run.deployment.url && (
                <a
                  href={run.deployment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-sm text-green-400 transition hover:bg-green-500/20"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {run.deployment.url}
                </a>
              )}
              {run.deployment.log.length > 0 && (
                <div className="mt-2 space-y-1">
                  {run.deployment.log.map((entry, idx) => (
                    <p key={idx} className="text-xs text-white/30 font-mono">
                      {entry}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {run.error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
              {run.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
