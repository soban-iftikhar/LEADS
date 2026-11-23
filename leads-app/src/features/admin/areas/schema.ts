import { z } from "zod";

export const areaSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Area name is needed").max(80),
  regionId: z.uuid("City is needed"),
  kind: z.enum(["SECTOR", "SOCIETY", "AREA"]),
  status: z.enum(["active", "off"]),
});
export type AreaForm = z.infer<typeof areaSchema>;
