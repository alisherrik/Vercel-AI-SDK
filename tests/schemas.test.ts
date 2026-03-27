import { describe, expect, it } from "vitest";

import { plannerTurnSchema } from "@/lib/planner/schemas";

describe("planner turn schema", () => {
  it("accepts valid planner turns with exactly three suggestions", () => {
    expect(() =>
      plannerTurnSchema.parse({
        message: "Who is the primary user for the product?",
        suggestions: [
          {
            id: "founders-1",
            label: "Founders",
            value: "Founders are the primary user.",
          },
          {
            id: "ops-2",
            label: "Ops teams",
            value: "Operations teams are the primary user.",
          },
          {
            id: "sales-3",
            label: "Sales teams",
            value: "Sales teams are the primary user.",
          },
        ],
        briefDelta: {
          appGoal: "Turn founder chats into build-ready product plans.",
        },
        missingFields: ["targetUsers", "mainProblem"],
        readyToGenerate: false,
      }),
    ).not.toThrow();
  });

  it("rejects planner turns that do not contain exactly three suggestions", () => {
    expect(() =>
      plannerTurnSchema.parse({
        message: "Who is the primary user for the product?",
        suggestions: [
          {
            id: "founders-1",
            label: "Founders",
            value: "Founders are the primary user.",
          },
          {
            id: "ops-2",
            label: "Ops teams",
            value: "Operations teams are the primary user.",
          },
        ],
        briefDelta: {
          appGoal: "Turn founder chats into build-ready product plans.",
        },
        missingFields: ["targetUsers", "mainProblem"],
        readyToGenerate: false,
      }),
    ).toThrow();
  });
});
