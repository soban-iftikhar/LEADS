import { z } from "zod";

export const stageFilter = z.enum(["new", "contacted", "viewing", "won", "lost", "reported"]);

export const leadsQuerySchema = z.object({
  stage: stageFilter.optional(),
  listing: z.uuid().optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const patchLeadSchema = z
  .object({
    customerStage: z.enum(["NEW", "CONTACTED", "VIEWING", "CLOSED_WON", "CLOSED_LOST"]),
    note: z.string().max(2000, "Keep the note under 2000 characters."),
    followUpAt: z.iso.datetime({ offset: true }).nullable(),
    followUpKind: z.enum(["CALL", "VISIT"]).nullable(),
  })
  .partial();

export const reportLeadSchema = z.object({
  reason: z.enum(["WRONG_NUMBER", "NEVER_REPLIED", "NOT_BUYING", "IS_AGENT", "DUPLICATE", "OTHER"], { error: () => ({ message: "Pick a reason." }) }),
  details: z.string().trim().max(500, "Keep it under 500 characters.").optional(),
});

export type LeadsQuery = z.infer<typeof leadsQuerySchema>;
export type LeadPatch = z.infer<typeof patchLeadSchema>;
