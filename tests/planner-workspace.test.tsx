import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlannerWorkspace } from "@/components/planner-workspace";
import { STORAGE_KEY } from "@/lib/planner/brief";

describe("PlannerWorkspace", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("does not submit empty answers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PlannerWorkspace />);

    const composer = screen.getByLabelText("Your answer");
    await user.click(composer);
    await user.keyboard(" ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores a saved chat session from sessionStorage", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        brief: {
          title: "ScopeFlow",
          language: "English",
          appGoal: "Turn client requests into polished briefs",
          targetUsers: ["Agency owners"],
          mainProblem: "",
          mustHaveFeatures: [],
          keyScreens: [],
          platformExpectations: [],
          dataAndAuthNeeds: [],
          integrations: [],
          visualStyleDirection: [],
          technicalNotes: [],
          assumptions: [],
        },
        questionCount: 1,
        artifact: null,
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "Tell me what you want to build.",
            createdAt: new Date().toISOString(),
            suggestions: [
              {
                id: "one",
                label: "B2B SaaS",
                value: "I want to build a B2B SaaS app.",
              },
              {
                id: "two",
                label: "Internal tool",
                value: "I want to build an internal tool.",
              },
              {
                id: "three",
                label: "Consumer app",
                value: "I want to build a consumer app.",
              },
            ],
          },
          {
            id: "user-1",
            role: "user",
            content: "I want a planning assistant for agencies.",
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );

    render(<PlannerWorkspace />);

    expect(
      await screen.findByText("I want a planning assistant for agencies."),
    ).toBeInTheDocument();
    expect(screen.getByText("ScopeFlow")).toBeInTheDocument();
  });

  it("walks through follow-up questions and auto-generates the markdown handoff preview", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Who is the main user you are building this for?",
            suggestions: [
              {
                id: "freelancers-1",
                label: "Freelancers",
                value: "Freelancers are the primary users.",
              },
              {
                id: "agencies-2",
                label: "Agencies",
                value: "Small agencies are the primary users.",
              },
              {
                id: "startups-3",
                label: "Startups",
                value: "Startup founders are the primary users.",
              },
            ],
            briefDelta: {
              title: "Invoice Sprint",
              appGoal: "Help independent workers send invoices and reminders faster.",
            },
            missingFields: ["targetUsers", "mustHaveFeatures"],
            readyToGenerate: false,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message:
              "I have enough detail now. I am turning this into the final markdown handoff.",
            suggestions: [
              {
                id: "ready-1",
                label: "Generate",
                value: "Generate the plan now.",
              },
              {
                id: "assumptions-2",
                label: "Use assumptions",
                value: "Generate the plan with reasonable assumptions.",
              },
              {
                id: "ship-3",
                label: "Ship it",
                value: "Generate the final markdown handoff.",
              },
            ],
            briefDelta: {
              targetUsers: ["Freelancers"],
              mainProblem: "Manual invoicing and chasing payments takes too much time.",
              mustHaveFeatures: ["Invoice creation", "Reminder automation"],
              keyScreens: ["Dashboard", "Invoice builder", "Client list"],
              platformExpectations: ["Responsive web app"],
              dataAndAuthNeeds: ["Email login", "Basic client records"],
              integrations: ["Stripe"],
              visualStyleDirection: ["Warm editorial minimalism"],
              technicalNotes: ["Use Next.js App Router and Vercel AI SDK"],
            },
            missingFields: [],
            readyToGenerate: true,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: "Invoice Sprint",
            fileName: "invoice-sprint-plan.md",
            markdown:
              "# Invoice Sprint\n\n## App Summary\nA streamlined invoicing assistant for freelancers.\n\n## Vibe Coding Prompt\nBuild a responsive web app with a chat-guided planner and markdown export.",
          }),
          { status: 200 },
        ),
      );

    const user = userEvent.setup();
    render(<PlannerWorkspace />);

    await user.type(
      screen.getByLabelText("Your answer"),
      "I want an app that helps freelancers send invoices quickly.",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("Who is the main user you are building this for?"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Freelancers" }));

    await screen.findByRole("button", { name: "Download .md" });
    expect(
      screen.getByText("A streamlined invoicing assistant for freelancers."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
