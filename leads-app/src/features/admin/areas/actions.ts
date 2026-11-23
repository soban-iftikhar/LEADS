"use server";

import { done } from "@/lib/admin/action-result";
import { adminAction } from "@/server/modules/admin/action";
import { saveArea } from "@/server/modules/admin/areas";
import { refreshAdminViews } from "@/server/modules/admin/refresh";
import { areaSchema } from "./schema";

export const saveAreaAction = adminAction(areaSchema, async (input, actor) => {
  const r = await saveArea(actor, input);
  refreshAdminViews();
  return done(r.created ? "Area added" : "Area saved");
});
