import { z } from "zod";

export const DispositionSchema = z.enum([
  "emergency",
  "urgent",
  "routine",
  "self_care",
]);

export const TriageResultSchema = z.object({
  disposition: DispositionSchema,
  rationale: z.string().min(10).max(500),
  plainEnglishSummary: z.string().min(10).max(600),
  immediateActions: z.array(z.string().min(3).max(200)).min(1).max(5),
  redFlagsToMonitor: z.array(z.string().min(3).max(200)).min(1).max(6),
  pointOfCareChecklist: z.array(z.string().min(3).max(200)).min(1).max(6),
  confidenceScore: z.number().min(0).max(1),
  clinicalFlags: z.array(z.string()),
});

export type Disposition = z.infer<typeof DispositionSchema>;
export type TriageResult = z.infer<typeof TriageResultSchema>;
