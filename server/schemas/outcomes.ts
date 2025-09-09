import { z } from 'zod';

export const OutcomeRecordSchema = z.object({
  threadId: z.string(),
  commentUrl: z.string(),
  status: z.enum(['pending', 'alive', 'removed']),
  insertedAt: z.number(),
  checkedAt: z.number().optional(),
  upvotes24h: z.number().optional(),
  replies24h: z.number().optional(),
  sessionId: z.string().optional(),
});

export const CreateOutcomeRequestSchema = z.object({
  threadId: z.string(),
  commentUrl: z.string().url(),
  sessionId: z.string(),
});

export const CreateOutcomeResponseSchema = z.object({
  success: z.boolean(),
  outcome: OutcomeRecordSchema,
});

export const OutcomesWorkerStatusSchema = z.object({
  processed: z.number(),
  updated: z.number(),
  errors: z.number(),
  lastRun: z.number(),
});

export type OutcomeRecord = z.infer<typeof OutcomeRecordSchema>;
export type CreateOutcomeRequest = z.infer<typeof CreateOutcomeRequestSchema>;
export type CreateOutcomeResponse = z.infer<typeof CreateOutcomeResponseSchema>;
export type OutcomesWorkerStatus = z.infer<typeof OutcomesWorkerStatusSchema>;