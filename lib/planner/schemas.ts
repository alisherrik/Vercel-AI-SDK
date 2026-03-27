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
});

export const generatedArtifactSchema = generatedArtifactModelSchema.extend({
  fileName: nonEmptyString.max(120),
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

export const plannerSessionSchema = z.object({
  brief: projectBriefSchema,
  messages: z.array(chatMessageSchema),
  questionCount: z.number().int().min(0).max(25).default(0),
  artifact: generatedArtifactSchema.nullable().default(null),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type DiscoveryField = z.infer<typeof discoveryFieldSchema>;
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;
export type PlannerSession = z.infer<typeof plannerSessionSchema>;
export type PlannerTurn = z.infer<typeof plannerTurnSchema>;
export type ProjectBrief = z.infer<typeof projectBriefSchema>;
export type ProjectBriefDelta = z.infer<typeof projectBriefDeltaSchema>;
export type PromptMessage = z.infer<typeof promptMessageSchema>;
export type SuggestedAnswer = z.infer<typeof suggestedAnswerSchema>;
