import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { DEFAULT_QUALITY, type QualityRules } from "@/server/modules/listings/rules";

/**
 * Typed reads of `config.app_settings` (values an admin changes without a deploy). A missing or
 * malformed value falls back to the default, so a bad edit can't take a page down.
 */

const SETTINGS = {
  "listings.quality": {
    schema: z.object({ minPhotos: z.number().int().min(1).max(30), minDescription: z.number().int().min(0).max(2000) }),
    fallback: DEFAULT_QUALITY satisfies QualityRules,
  },
  "payments.bank_transfer": {
    schema: z.object({ bank: z.string().min(1), accountTitle: z.string().min(1), iban: z.string().min(1) }).nullable(),
    fallback: null as { bank: string; accountTitle: string; iban: string } | null,
  },
  "leads.report_window_days": { schema: z.number().int().min(1).max(60), fallback: 7 },
} as const;

type Key = keyof typeof SETTINGS;
type Value<K extends Key> = (typeof SETTINGS)[K]["fallback"];

export async function setting<K extends Key>(key: K): Promise<Value<K>> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row) return SETTINGS[key].fallback;
  const parsed = SETTINGS[key].schema.safeParse(row.value);
  if (!parsed.success) {
    console.warn(`[settings] ${key} is malformed; using the default`);
    return SETTINGS[key].fallback;
  }
  return parsed.data as Value<K>;
}
