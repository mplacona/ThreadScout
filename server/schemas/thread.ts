import { z } from 'zod';

export const CandidateThreadSchema = z.object({
  id: z.string(),
  sub: z.string(),
  title: z.string(),
  author: z.string(),
  permalink: z.string(),
  createdUtc: z.number(),
  upvotes: z.number(),
  comments: z.number(),
});

export const FullThreadSchema = CandidateThreadSchema.extend({
  body: z.string(),
  topComments: z.array(z.object({
    author: z.string(),
    body: z.string(),
  })),
});

export const RulesSummarySchema = z.object({
  linksAllowed: z.boolean(),
  vendorDisclosureRequired: z.boolean(),
  linkLimit: z.number().nullable(),
  notes: z.array(z.string()),
});

export const ThreadAnalysisSchema = z.object({
  thread: FullThreadSchema,
  score: z.number().min(0).max(100),
  whyFit: z.string(),
  rules: RulesSummarySchema,
  risks: z.array(z.string()),
  variantA: z.object({
    text: z.string(),
  }),
  variantB: z.object({
    text: z.string(),
    disclosure: z.string().optional(),
  }),
});

export const SessionDataSchema = z.object({
  sessionId: z.string(),
  createdAt: z.number(),
  threads: z.array(ThreadAnalysisSchema),
  scanParams: z.object({
    subs: z.array(z.string()),
    keywords: z.array(z.string()),
    lookbackHours: z.number(),
    allowlist: z.array(z.string()),
  }),
});

export type CandidateThread = z.infer<typeof CandidateThreadSchema>;
export type FullThread = z.infer<typeof FullThreadSchema>;
export type RulesSummary = z.infer<typeof RulesSummarySchema>;
export type ThreadAnalysis = z.infer<typeof ThreadAnalysisSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;