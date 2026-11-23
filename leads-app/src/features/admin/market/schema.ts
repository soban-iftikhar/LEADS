import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9-]{1,60}$/);

/** ?city=<region>&type=house|plot&size=5|10|20&mode=price|change&period=day|week|month|year&areas=g-13,b-17&area=<open drawer> */
export const marketParamsSchema = z.object({
  city: slug.optional().catch(undefined),
  type: z.enum(["house", "plot"]).catch("house"),
  size: z.enum(["5", "10", "20"]).catch("10"),
  mode: z.enum(["price", "change"]).catch("price"),
  period: z.enum(["day", "week", "month", "year"]).catch("month"),
  areas: z
    .string()
    .transform((s) => s.split(",").filter((x) => slug.safeParse(x).success))
    .optional()
    .catch(undefined),
  area: slug.optional().catch(undefined),
});
export type MarketParams = z.infer<typeof marketParamsSchema>;
