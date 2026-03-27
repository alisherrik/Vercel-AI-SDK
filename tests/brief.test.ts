import { describe, expect, it } from "vitest";

import {
  createEmptyBrief,
  getMissingFields,
  mergeProjectBrief,
  shouldGenerateNow,
} from "@/lib/planner/brief";

describe("planner brief helpers", () => {
  it("merges text fields and deduplicates array fields", () => {
    const currentBrief = {
      ...createEmptyBrief(),
      appGoal: "Help founders scope ideas",
      mustHaveFeatures: ["Chat interview", "Markdown export"],
      integrations: ["OpenAI"],
    };

    const merged = mergeProjectBrief(currentBrief, {
      mainProblem: "Founders waste time rewriting product requirements",
      mustHaveFeatures: ["Markdown export", "Download .md"],
      integrations: ["openai", "Slack"],
    });

    expect(merged.mainProblem).toBe(
      "Founders waste time rewriting product requirements",
    );
    expect(merged.mustHaveFeatures).toEqual([
      "Chat interview",
      "Markdown export",
      "Download .md",
    ]);
    expect(merged.integrations).toEqual(["OpenAI", "Slack"]);
  });

  it("reports missing discovery fields deterministically", () => {
    const brief = createEmptyBrief();

    expect(getMissingFields(brief)).toEqual([
      "appGoal",
      "targetUsers",
      "mainProblem",
      "mustHaveFeatures",
      "keyScreens",
      "platformExpectations",
      "dataAndAuthNeeds",
      "integrations",
      "visualStyleDirection",
    ]);
  });

  it("forces generation when the question cap is reached", () => {
    expect(shouldGenerateNow(8, ["integrations"])).toBe(true);
    expect(shouldGenerateNow(2, ["integrations"])).toBe(false);
    expect(shouldGenerateNow(2, [])).toBe(true);
  });
});
