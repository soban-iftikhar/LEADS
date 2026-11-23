import { z } from "zod";

export const RANGES = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "3 months" },
] as const;

/** ?city=<region slug>|all&range=week|month|quarter */
export const overviewParamsSchema = z.object({
  city: z.string().regex(/^[a-z0-9-]{1,40}$/).catch("all"),
  range: z.enum(["week", "month", "quarter"]).catch("week"),
});
export type OverviewParams = z.infer<typeof overviewParamsSchema>;
