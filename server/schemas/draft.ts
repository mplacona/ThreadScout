import { z } from 'zod';

export const DraftVariantSchema = z.object({
  text: z.string(),
  disclosure: z.string().optional(),
});

export const AgentResponseSchema = z.object({
  score: z.number().min(0).max(100),
  whyFit: z.string(),
  rulesSummary: z.array(z.string()),
  risks: z.array(z.string()),
  variantA: DraftVariantSchema,
  variantB: DraftVariantSchema,
});

export const ScanRequestSchema = z.object({
  subs: z.array(z.string()).min(1).max(10),
  keywords: z.array(z.string()).min(1).max(20),
  lookbackHours: z.number().min(1).max(168), // 1 hour to 1 week
  threadLimit: z.number().min(1).max(50).default(10).optional(), // Max threads to analyze
  sessionId: z.string().optional(),
  allowlist: z.array(z.string()).default([]).optional(), // Optional for backwards compatibility
});

export const ScanResponseSchema = z.object({
  sessionId: z.string(),
  threads: z.array(z.object({
    thread: z.object({
      id: z.string(),
      sub: z.string(),
      title: z.string(),
      author: z.string(),
      permalink: z.string(),
      createdUtc: z.number(),
      upvotes: z.number(),
      comments: z.number(),
      body: z.string(),
      topComments: z.array(z.object({
        author: z.string(),
        body: z.string(),
      })),
    }),
    score: z.number(),
    whyFit: z.string(),
    rules: z.object({
      linksAllowed: z.boolean(),
      vendorDisclosureRequired: z.boolean(),
      linkLimit: z.number().nullable(),
      notes: z.array(z.string()),
    }),
    risks: z.array(z.string()),
    variantA: DraftVariantSchema,
    variantB: DraftVariantSchema,
  })),
});

export type DraftVariant = z.infer<typeof DraftVariantSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type ScanRequest = z.infer<typeof ScanRequestSchema>;
export type ScanResponse = z.infer<typeof ScanResponseSchema>;