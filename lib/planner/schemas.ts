import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const shortString = z.string().trim().max(140);
const briefList = z.array(shortString.min(1)).max(12);

export const discoveryFields = [
  "appGoal",
  "targetUsers",
  "mainProblem",
  "mustHaveFeatures",
  "keyScreens",
  "platformExpectations",
  "dataAndAuthNeeds",
  "integrations",
  "visualStyleDirection",
] as const;

export const discoveryFieldSchema = z.enum(discoveryFields);

const briefFieldShape = {
  title: z.string().trim().max(80),
  description: z.string().trim().max(2000),
  language: z.string().trim().max(40),
  appGoal: z.string().trim().max(320),
  targetUsers: briefList,
  mainProblem: z.string().trim().max(320),
  mustHaveFeatures: briefList,
  keyScreens: briefList,
  platformExpectations: briefList,
  dataAndAuthNeeds: briefList,
  integrations: briefList,
  visualStyleDirection: briefList,
  technicalNotes: briefList,
  assumptions: briefList,
};

export const projectBriefSchema = z.object({
  title: briefFieldShape.title.default(""),
  description: briefFieldShape.description.default(""),
  language: briefFieldShape.language.default("English"),
  appGoal: briefFieldShape.appGoal.default(""),
  targetUsers: briefFieldShape.targetUsers.default([]),
  mainProblem: briefFieldShape.mainProblem.default(""),
  mustHaveFeatures: briefFieldShape.mustHaveFeatures.default([]),
  keyScreens: briefFieldShape.keyScreens.default([]),
  platformExpectations: briefFieldShape.platformExpectations.default([]),
  dataAndAuthNeeds: briefFieldShape.dataAndAuthNeeds.default([]),
  integrations: briefFieldShape.integrations.default([]),
  visualStyleDirection: briefFieldShape.visualStyleDirection.default([]),
  technicalNotes: briefFieldShape.technicalNotes.default([]),
  assumptions: briefFieldShape.assumptions.default([]),
});

export const projectBriefDeltaSchema = z.object({
  title: briefFieldShape.title.optional(),
  description: briefFieldShape.description.optional(),
  language: briefFieldShape.language.optional(),
  appGoal: briefFieldShape.appGoal.optional(),
  targetUsers: briefFieldShape.targetUsers.optional(),
  mainProblem: briefFieldShape.mainProblem.optional(),
  mustHaveFeatures: briefFieldShape.mustHaveFeatures.optional(),
  keyScreens: briefFieldShape.keyScreens.optional(),
  platformExpectations: briefFieldShape.platformExpectations.optional(),
  dataAndAuthNeeds: briefFieldShape.dataAndAuthNeeds.optional(),
  integrations: briefFieldShape.integrations.optional(),
  visualStyleDirection: briefFieldShape.visualStyleDirection.optional(),
  technicalNotes: briefFieldShape.technicalNotes.optional(),
  assumptions: briefFieldShape.assumptions.optional(),
});

export const suggestedAnswerSchema = z.object({
  id: nonEmptyString.max(80),
  label: nonEmptyString.max(60),
  value: nonEmptyString.max(240),
});

export const suggestedAnswerModelSchema = suggestedAnswerSchema.omit({ id: true });

export const chatMessageSchema = z.object({
  id: nonEmptyString.max(80),
  role: z.enum(["assistant", "user"]),
  content: nonEmptyString.max(4000),
  createdAt: nonEmptyString.max(80),
  suggestions: z.array(suggestedAnswerSchema).length(3).optional(),
});

export const promptMessageSchema = z.object({
  role: z.enum(["assistant", "user"]),
  content: nonEmptyString.max(4000),
});

export const plannerTurnModelSchema = z.object({
  message: nonEmptyString.max(500),
  suggestions: z.array(suggestedAnswerModelSchema).length(3),
  briefDelta: projectBriefDeltaSchema.default({}),
  missingFields: z.array(discoveryFieldSchema).max(discoveryFields.length),
  readyToGenerate: z.boolean(),
});

export const plannerTurnSchema = z.object({
  message: nonEmptyString.max(500),
  suggestions: z.array(suggestedAnswerSchema).length(3),
  briefDelta: projectBriefDeltaSchema.default({}),
  missingFields: z.array(discoveryFieldSchema).max(discoveryFields.length),
  readyToGenerate: z.boolean(),
});

export const generatedArtifactModelSchema = z.object({
  title: nonEmptyString.max(100),
  markdown: nonEmptyString,
  userMarkdown: z.string().trim(),
});

export const generatedArtifactSchema = generatedArtifactModelSchema.extend({
  fileName: nonEmptyString.max(120),
});

export const starterKindSchema = z.enum(["landing", "dashboard", "content"]);

export const appSpecSchema = z.object({
  appName: nonEmptyString.max(80),
  starterKind: starterKindSchema,
  pages: briefList.min(1),
  sections: briefList.min(1),
  theme: z.object({
    headline: shortString.min(1),
    background: z.string().trim().max(30),
    surface: z.string().trim().max(30),
    accent: z.string().trim().max(30),
    text: z.string().trim().max(30),
  }),
  copyTone: shortString.min(1),
  features: briefList.min(1),
  assetsNeeded: briefList.default([]),
  githubPagesConstraints: briefList.min(1),
  issueInputs: z.object({
    primaryGoal: shortString.min(1),
    audience: briefList.min(1),
    coreScreens: briefList.min(1),
    interactions: briefList.min(1),
  }),
  briefContext: z.object({
    userDescription: z.string().max(2000).default(""),
    mainProblem: z.string().max(320).default(""),
    dataAndAuthNeeds: briefList.default([]),
    integrations: briefList.default([]),
    visualStyleDirection: briefList.default([]),
    targetUsers: briefList.default([]),
    platformExpectations: briefList.default([]),
  }).default({
    userDescription: "",
    mainProblem: "",
    dataAndAuthNeeds: [],
    integrations: [],
    visualStyleDirection: [],
    targetUsers: [],
    platformExpectations: [],
  }),
});

export const generatedFileSchema = z.object({
  path: nonEmptyString.max(160),
  content: nonEmptyString,
});

export const generatedAppSchema = z.object({
  name: nonEmptyString.max(80),
  starterKind: starterKindSchema,
  files: z.array(generatedFileSchema).min(1).max(30),
});

export const issuePlanSchema = z.object({
  id: nonEmptyString.max(80),
  title: nonEmptyString.max(120),
  summary: nonEmptyString.max(2000),
  githubIssueNumber: z.number().int().positive().nullable().default(null),
  allowedFiles: z.array(nonEmptyString.max(160)).min(1).max(20),
  acceptanceCriteria: z.array(nonEmptyString.max(400)).min(1).max(12),
  expectedDomTargets: z.array(nonEmptyString.max(120)).max(10).default([]),
  ciChecks: z.array(nonEmptyString.max(80)).min(1).max(6),
  status: z
    .enum(["pending", "in_progress", "merged", "completed", "failed", "skipped"])
    .default("pending"),
});

export const gitHubRepoSchema = z.object({
  owner: nonEmptyString.max(80),
  name: nonEmptyString.max(100),
  url: nonEmptyString.max(300),
  defaultBranch: nonEmptyString.max(80).default("main"),
});

export const pullRequestRecordSchema = z.object({
  issueId: nonEmptyString.max(80),
  branchName: nonEmptyString.max(120),
  url: nonEmptyString.max(300),
  status: z.enum(["open", "merged", "failed"]),
});

export const issueExecutionSchema = z.object({
  issueId: nonEmptyString.max(80),
  status: z.enum(["pending", "running", "completed", "failed", "skipped"]),
  branchName: z.string().trim().max(120).default(""),
  pullRequestUrl: z.string().trim().max(300).default(""),
  conversationUrl: z.string().trim().max(300).default(""),
  log: z.array(nonEmptyString.max(1000)).default([]),
});

export const deploymentRecordSchema = z.object({
  provider: z.literal("github-pages"),
  status: z.enum(["pending", "deploying", "success", "failed"]),
  url: z.string().trim().max(300).default(""),
  log: z.array(nonEmptyString.max(1000)).default([]),
});

export const buildRunStageSchema = z.enum([
  "queued",
  "spec_ready",
  "repo_provisioned",
  "issues_created",
  "executing_issues",
  "deploying",
  "completed",
  "failed",
]);

export const buildRunSchema = z.object({
  id: nonEmptyString.max(80),
  createdAt: nonEmptyString.max(80),
  updatedAt: nonEmptyString.max(80),
  status: buildRunStageSchema,
  plannerTitle: z.string().trim().max(100).default(""),
  summary: z.string().trim().max(280).default(""),
  appSpec: appSpecSchema.nullable().default(null),
  generatedApp: generatedAppSchema.nullable().default(null),
  repo: gitHubRepoSchema.nullable().default(null),
  issues: z.array(issuePlanSchema).default([]),
  issueExecutions: z.array(issueExecutionSchema).default([]),
  pullRequests: z.array(pullRequestRecordSchema).default([]),
  deployment: deploymentRecordSchema.nullable().default(null),
  finalArtifactUrls: z
    .object({
      repoUrl: z.string().trim().max(300).default(""),
      pagesUrl: z.string().trim().max(300).default(""),
    })
    .nullable()
    .default(null),
  error: z.string().trim().max(400).nullable().default(null),
});

export const plannerTurnRequestSchema = z.object({
  latestAnswer: nonEmptyString.max(1000),
  brief: projectBriefSchema.default(projectBriefSchema.parse({})),
  messages: z.array(promptMessageSchema).max(20).default([]),
  questionCount: z.number().int().min(0).max(25).default(0),
  maxQuestions: z.number().int().min(1).max(25).default(8),
});

export const plannerGenerateRequestSchema = z.object({
  brief: projectBriefSchema,
  messages: z.array(promptMessageSchema).max(20).default([]),
});

export const buildRunCreateRequestSchema = z.object({
  brief: projectBriefSchema,
  messages: z.array(promptMessageSchema).max(20).default([]),
});

export const plannerSessionSchema = z.object({
  brief: projectBriefSchema,
  messages: z.array(chatMessageSchema),
  questionCount: z.number().int().min(0).max(25).default(0),
  artifact: generatedArtifactSchema.nullable().default(null),
  buildRunId: z.string().trim().max(80).nullable().default(null),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type AppSpec = z.infer<typeof appSpecSchema>;
export type BuildRun = z.infer<typeof buildRunSchema>;
export type BuildRunCreateRequest = z.infer<typeof buildRunCreateRequestSchema>;
export type BuildRunStage = z.infer<typeof buildRunStageSchema>;
export type DeploymentRecord = z.infer<typeof deploymentRecordSchema>;
export type DiscoveryField = z.infer<typeof discoveryFieldSchema>;
export type GeneratedApp = z.infer<typeof generatedAppSchema>;
export type GeneratedFile = z.infer<typeof generatedFileSchema>;
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;
export type GitHubRepo = z.infer<typeof gitHubRepoSchema>;
export type IssueExecution = z.infer<typeof issueExecutionSchema>;
export type IssuePlan = z.infer<typeof issuePlanSchema>;
export type PlannerSession = z.infer<typeof plannerSessionSchema>;
export type PlannerTurn = z.infer<typeof plannerTurnSchema>;
export type ProjectBrief = z.infer<typeof projectBriefSchema>;
export type ProjectBriefDelta = z.infer<typeof projectBriefDeltaSchema>;
export type PromptMessage = z.infer<typeof promptMessageSchema>;
export type PullRequestRecord = z.infer<typeof pullRequestRecordSchema>;
export type SuggestedAnswer = z.infer<typeof suggestedAnswerSchema>;
export type StarterKind = z.infer<typeof starterKindSchema>;
