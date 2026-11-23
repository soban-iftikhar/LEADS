import type { Prisma } from "@prisma/client";
import type { SeedContext } from "./context";
import settings from "./settings.json";

/** Admin-editable settings (config.app_settings), upserted by key. */
export async function seedSettings({ prisma }: SeedContext) {
  for (const [key, value] of Object.entries(settings)) {
    await prisma.appSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
  }
  return Object.keys(settings).length;
}
