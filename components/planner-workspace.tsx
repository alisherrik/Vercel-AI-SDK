"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  createChatMessage,
  createFileName,
  createInitialSession,
  mergeProjectBrief,
  MAX_PLANNER_QUESTIONS,
  STORAGE_KEY,
  toPromptMessages,
} from "@/lib/planner/brief";
import {
  generatedArtifactSchema,
  plannerSessionSchema,
  plannerTurnSchema,
  type BuildRun,
  type GeneratedArtifact,
  type PlannerSession,
} from "@/lib/planner/schemas";

type WorkspaceStatus = "ready" | "submitting" | "error";
type RetryAction = { type: "turn"; answer: string } | { type: "generate" } | null;

export function PlannerWorkspace() {
  const [session, setSession] = useState<PlannerSession>(createInitialSession);
  const [composerValue, setComposerValue] = useState("");
  const [status, setStatus] = useState<WorkspaceStatus>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<RetryAction>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [hydrated, setHydrated] = useState(false);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planDone, setPlanDone] = useState(false);
  const [buildRun, setBuildRun] = useState<BuildRun | null>(null);
  const [buildLaunching, setBuildLaunching] = useState(false);
  const [docTab, setDocTab] = useState<"agent" | "user">("user");
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const deferredMarkdown = useDeferredValue(session.artifact?.markdown ?? "");
  const deferredUserMarkdown = useDeferredValue(session.artifact?.userMarkdown ?? "");
  const hasArtifact = !!session.artifact;
  const abortControllerRef = useRef<AbortController | null>(null);

  const persistSession = useEffectEvent((nextSession: PlannerSession) => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  });

  useEffect(() => {
    const rawSession = window.sessionStorage.getItem(STORAGE_KEY);

    if (!rawSession) {
      setHydrated(true);
      return;
    }

    try {
      const parsed = plannerSessionSchema.parse(JSON.parse(rawSession));
      setSession(parsed);
    } catch (error) {
      console.warn("[planner-session]", error);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistSession(session);
  }, [hydrated, session]);

  useEffect(() => {
    if (!session.buildRunId) {
      setBuildRun(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/build-runs/${session.buildRunId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load build run status.");
        }

        const nextRun = (await response.json()) as BuildRun;

        if (!cancelled) {
          setBuildRun(nextRun);
        }

        if (
          !cancelled &&
          [
            "queued",
            "repo_provisioned",
            "issues_created",
            "executing_issues",
            "deploying",
          ].includes(
            nextRun.status,
          )
        ) {
          window.setTimeout(poll, 5000);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load build run status.",
          );
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [session.buildRunId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({
      behavior: hydrated ? "smooth" : "auto",
      block: "end",
    });
  }, [hydrated, session.messages.length, status]);

  async function submitAnswer(answer: string, options?: { resend?: boolean }) {
    const trimmedAnswer = answer.trim();

    if (!trimmedAnswer || status === "submitting") {
      return;
    }

    setErrorMessage(null);
    setRetryAction(null);

    const baseSession = options?.resend
      ? session
      : {
          ...session,
          messages: [...session.messages, createChatMessage("user", trimmedAnswer)],
        };

    if (!options?.resend) {
      setSession(baseSession);
      setComposerValue("");
    }

    setStatus("submitting");

    try {
      const response = await fetch("/api/planner/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latestAnswer: trimmedAnswer,
          brief: baseSession.brief,
          messages: toPromptMessages(baseSession.messages),
          questionCount: baseSession.questionCount,
          maxQuestions: MAX_PLANNER_QUESTIONS,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "The planner could not continue the interview.",
        );
      }

      const plannerTurn = plannerTurnSchema.parse(payload);
      const nextBrief = mergeProjectBrief(baseSession.brief, plannerTurn.briefDelta);
      const nextQuestionCount = baseSession.questionCount + 1;

      const nextSession: PlannerSession = {
        ...baseSession,
        brief: nextBrief,
        questionCount: nextQuestionCount,
        messages: [
          ...baseSession.messages,
          createChatMessage(
            "assistant",
            plannerTurn.message,
            plannerTurn.readyToGenerate ? undefined : plannerTurn.suggestions,
          ),
        ],
      };

      setSession(nextSession);
      setStatus("ready");

    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The planner could not continue the interview.",
      );
      setRetryAction({ type: "turn", answer: trimmedAnswer });
    }
  }

  const generateArtifactInBackground = useCallback(
    async (baseSession: PlannerSession): Promise<GeneratedArtifact | null> => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setPlanGenerating(true);

      try {
        const response = await fetch("/api/planner/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: baseSession.brief,
            messages: toPromptMessages(baseSession.messages),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMsg = "Plan generation failed.";
          try {
            const payload = await response.json();
            if (payload?.error) errorMsg = payload.error;
          } catch {}
          throw new Error(errorMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream available.");

        const decoder = new TextDecoder();
        let fullText = "";
        let partialObject: { title?: string; markdown?: string; userMarkdown?: string } = {};

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) {
            reader.cancel();
            return null;
          }

          fullText += decoder.decode(value, { stream: true });

          try {
            partialObject = JSON.parse(fullText);
          } catch {
            const titleMatch = fullText.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const mdMatch = fullText.match(
              new RegExp('"markdown"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', "s"),
            );
            const userMdMatch = fullText.match(
              new RegExp('"userMarkdown"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', "s"),
            );
            if (titleMatch) partialObject.title = JSON.parse(`"${titleMatch[1]}"`);
            if (mdMatch) {
              try {
                partialObject.markdown = JSON.parse(`"${mdMatch[1]}"`);
              } catch {
                partialObject.markdown = mdMatch[1]
                  .replace(/\\n/g, "\n")
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, "\\");
              }
            }
            if (userMdMatch) {
              try {
                partialObject.userMarkdown = JSON.parse(`"${userMdMatch[1]}"`);
              } catch {
                partialObject.userMarkdown = userMdMatch[1]
                  .replace(/\\n/g, "\n")
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, "\\");
              }
            }
          }

          if (partialObject.markdown && !controller.signal.aborted) {
            startTransition(() => {
              setSession((prev) => ({
                ...prev,
                artifact: {
                  title:
                    partialObject.title || baseSession.brief.title || "Generating...",
                  markdown: partialObject.markdown || "",
                  userMarkdown: partialObject.userMarkdown || "",
                  fileName: createFileName(
                    partialObject.title || baseSession.brief.title || "handoff",
                  ),
                },
              }));
            });
          }
        }

        if (controller.signal.aborted) return null;

        // Flush any remaining bytes from the decoder
        const remaining = decoder.decode();
        if (remaining) fullText += remaining;

        // Final parse attempt on the complete text
        try {
          const finalParsed = JSON.parse(fullText);
          if (finalParsed.markdown) partialObject.markdown = finalParsed.markdown;
          if (finalParsed.userMarkdown) partialObject.userMarkdown = finalParsed.userMarkdown;
          if (finalParsed.title) partialObject.title = finalParsed.title;
        } catch {
          // Already attempted regex extraction during streaming
        }

        const finalMarkdown = (partialObject.markdown || "").trim();
        if (!finalMarkdown) {
          console.error("[plan-generate] empty markdown. Raw stream length:", fullText.length, "Text preview:", fullText.slice(0, 500));
          throw new Error("Plan generation returned empty content. Please retry.");
        }

        const finalTitle =
          partialObject.title?.trim() ||
          baseSession.brief.title.trim() ||
          "Untitled app concept";

        const artifact = generatedArtifactSchema.parse({
          title: finalTitle,
          markdown: finalMarkdown,
          userMarkdown: (partialObject.userMarkdown || "").trim(),
          fileName: createFileName(finalTitle),
        });

        startTransition(() => {
          setSession((prev) => ({
            ...prev,
            artifact,
          }));
        });
        setPlanDone(true);
        return artifact;
      } catch (error) {
        if ((error as Error).name === "AbortError") return null;
        console.error("[plan-generate]", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Plan generation failed.",
        );
        setRetryAction({ type: "generate" });
        return null;
      } finally {
        if (!controller.signal.aborted) {
          setPlanGenerating(false);
        }
      }
    },
    [],
  );

  async function retryLastAction() {
    if (!retryAction) return;

    if (retryAction.type === "turn") {
      await submitAnswer(retryAction.answer, { resend: true });
      return;
    }

    await generateArtifactInBackground(session);
  }

  async function copyMarkdown() {
    if (!session.artifact) return;
    try {
      await window.navigator.clipboard.writeText(session.artifact.markdown);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {}
  }

  async function launchBuildRun() {
    if (buildLaunching || status === "submitting" || planGenerating) return;

    setBuildLaunching(true);
    setErrorMessage(null);

    try {
      const artifact =
        session.artifact || (await generateArtifactInBackground(session));

      if (!artifact) {
        throw new Error("Could not generate the technical plan for build.");
      }

      const response = await fetch("/api/build-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: session.brief,
          messages: toPromptMessages(session.messages),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Could not start the GitHub agent build.");
      }

      const nextRun = payload as BuildRun;
      setBuildRun(nextRun);
      setSession((prev) => ({
        ...prev,
        buildRunId: nextRun.id,
      }));
    } catch (error) {
      setErrorMessage(
          error instanceof Error ? error.message : "Could not start the GitHub agent build.",
      );
    } finally {
      setBuildLaunching(false);
    }
  }

  function downloadMarkdown(artifact: GeneratedArtifact) {
    const blob = new Blob([artifact.markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = artifact.fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  function resetSession() {
    abortControllerRef.current?.abort();
    const freshSession = createInitialSession();
    setSession(freshSession);
    setComposerValue("");
    setStatus("ready");
    setErrorMessage(null);
    setRetryAction(null);
    setCopyState("idle");
    setPlanGenerating(false);
    setPlanDone(false);
    setBuildRun(null);
    setBuildLaunching(false);
    setDocTab("user");
    window.sessionStorage.removeItem(STORAGE_KEY);
  }

  const latestInteractiveMessageId = [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.suggestions)?.id;

  const isThinking = status === "submitting";
  const isChatBusy = status === "submitting";

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-white/60 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
            P
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-[-0.01em] text-stone-800">
              Plan Pilot
            </h1>
            <p className="text-xs text-stone-500">
              AI product planner
            </p>
          </div>
        </div>
        <button
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-50"
          onClick={resetSession}
          type="button"
        >
          New chat
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex flex-col ${
            hasArtifact ? "w-1/2 border-r border-[var(--border)]" : "w-full"
          } transition-all duration-300`}
        >
          <div className="flex-1 overflow-y-auto">
            <div
              className={`mx-auto px-4 py-6 sm:px-6 ${
                hasArtifact ? "max-w-xl" : "max-w-2xl"
              }`}
            >
              <div className="flex flex-col gap-4">
                {session.brief.title && !hasArtifact && (
                  <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-600 shadow-sm">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
                      Working title
                    </p>
                    <p className="mt-1 font-semibold text-stone-900">
                      {session.brief.title}
                    </p>
                  </div>
                )}

                {session.messages.map((message) => {
                  const isAssistant = message.role === "assistant";
                  const canAnswer =
                    message.id === latestInteractiveMessageId && status === "ready";

                  return (
                    <div
                      className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                      key={message.id}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] ${
                          isAssistant ? "chat-bubble-assistant" : "chat-bubble-user"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </p>

                        {message.suggestions && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {message.suggestions.map((suggestion) => (
                              <button
                                className={`suggestion-chip ${
                                  canAnswer
                                    ? "suggestion-chip-active"
                                    : "suggestion-chip-disabled"
                                }`}
                                disabled={!canAnswer}
                                key={suggestion.id}
                                onClick={() => submitAnswer(suggestion.value)}
                                type="button"
                              >
                                {suggestion.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isThinking && (
                  <div className="flex justify-start">
                    <div className="chat-bubble-assistant">
                      <div className="flex items-center gap-1.5">
                        <span className="thinking-dot" />
                        <span className="thinking-dot [animation-delay:0.15s]" />
                        <span className="thinking-dot [animation-delay:0.3s]" />
                        <span className="ml-2 text-xs text-stone-400">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:max-w-[75%]">
                      <p className="text-sm text-red-700">{errorMessage}</p>
                      {retryAction && (
                        <button
                          className="mt-2 text-xs font-medium text-red-600 underline underline-offset-2 hover:text-red-800"
                          onClick={retryLastAction}
                          type="button"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div ref={threadEndRef} />
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--border)] bg-white/60 px-4 py-3 backdrop-blur sm:px-6">
            <form
              className={`mx-auto flex items-end gap-2 ${
                hasArtifact ? "max-w-xl" : "max-w-2xl"
              }`}
              onSubmit={(event) => {
                event.preventDefault();
                void submitAnswer(composerValue);
              }}
            >
              <div className="relative flex-1">
                <textarea
                  aria-label="Your answer"
                  className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 pr-10 text-sm leading-relaxed text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-300"
                  rows={1}
                  onChange={(event) => {
                    setComposerValue(event.target.value);
                    event.target.style.height = "auto";
                    event.target.style.height = `${Math.min(
                      event.target.scrollHeight,
                      160,
                    )}px`;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitAnswer(composerValue);
                    }
                  }}
                  placeholder={
                    planDone
                      ? "Add details or ask to change something..."
                      : "Type your answer..."
                  }
                  value={composerValue}
                  disabled={isChatBusy}
                />
              </div>
              <button
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all hover:bg-[#9a5730] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!composerValue.trim() || isChatBusy}
                type="submit"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
                </svg>
              </button>
              <button
                className="h-10 shrink-0 rounded-xl bg-stone-800 px-4 text-xs font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isChatBusy || buildLaunching || planGenerating}
                onClick={() => void launchBuildRun()}
                type="button"
              >
                {planGenerating
                  ? "Planning..."
                  : buildLaunching
                    ? "Building..."
                    : "Build"}
              </button>
            </form>
            <p
              className={`mx-auto mt-1.5 text-center text-[11px] text-stone-400 ${
                hasArtifact ? "max-w-xl" : "max-w-2xl"
              }`}
            >
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>

        {hasArtifact && session.artifact && (
          <div
            className={`plan-panel-enter flex w-1/2 flex-col overflow-hidden ${
              planGenerating ? "plan-panel-generating" : ""
            }`}
          >
            <div className="plan-accent-bar" />
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-white/40 px-5 py-3 backdrop-blur">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                    Plan
                  </p>
                  {planGenerating && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <span className="thinking-dot !h-1.5 !w-1.5" />
                      <span className="thinking-dot !h-1.5 !w-1.5 [animation-delay:0.15s]" />
                      <span className="thinking-dot !h-1.5 !w-1.5 [animation-delay:0.3s]" />
                      <span className="ml-0.5">Updating</span>
                    </span>
                  )}
                </div>
                <h2 className="mt-0.5 truncate text-sm font-semibold text-stone-800 transition-all duration-300">
                  {session.artifact.title}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#9a5730] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={launchBuildRun}
                  disabled={buildLaunching || !!session.buildRunId}
                  type="button"
                >
                  {buildLaunching
                    ? "Preparing..."
                    : buildRun
                      ? buildRun.status === "completed"
                        ? "Completed"
                        : buildRun.status === "failed"
                          ? "Failed"
                          : "Building..."
                      : "Build"}
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    docTab === "user"
                      ? "bg-stone-800 text-white"
                      : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                  onClick={() => setDocTab("user")}
                  type="button"
                >
                  Overview
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    docTab === "agent"
                      ? "bg-stone-800 text-white"
                      : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                  onClick={() => setDocTab("agent")}
                  type="button"
                >
                  Agent Spec
                </button>
                <button
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-50"
                  onClick={copyMarkdown}
                  type="button"
                >
                  {copyState === "copied" ? "Copied!" : "Copy"}
                </button>
                <button
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-700"
                  onClick={() => session.artifact && downloadMarkdown(session.artifact)}
                  type="button"
                >
                  Download .md
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {buildRun && (
                <section className="mb-5 rounded-[1.2rem] border border-stone-200 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
                        Implementation Build
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-stone-900">
                        {buildRun.status.replaceAll("_", " ")}
                      </h3>
                      {buildRun.repo && (
                        <p className="mt-1 text-xs text-stone-500">
                          Repo:{" "}
                          <a
                            className="font-medium text-[var(--accent)] underline underline-offset-2"
                            href={buildRun.repo.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {buildRun.repo.owner}/{buildRun.repo.name}
                          </a>
                        </p>
                      )}
                    </div>
                    {buildRun.finalArtifactUrls?.pagesUrl && (
                      <a
                        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-50"
                        href={buildRun.finalArtifactUrls.pagesUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open site
                      </a>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {buildRun.issueExecutions.slice(0, 6).map((execution) => (
                      <div
                        className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2"
                        key={execution.issueId}
                      >
                        <p className="text-xs font-medium text-stone-800">
                          {execution.issueId}
                        </p>
                        <p className="mt-0.5 text-[11px] text-stone-500">
                          {execution.status.replaceAll("_", " ")}
                          {execution.log[0] ? ` · ${execution.log[0]}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>

                  {buildRun.error && (
                    <p className="mt-3 text-xs text-red-600">{buildRun.error}</p>
                  )}
                </section>
              )}

              <div className="markdown-content markdown-content-animated max-w-none text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {docTab === "user" ? deferredUserMarkdown || deferredMarkdown : deferredMarkdown}
                  </ReactMarkdown>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
