import { execFileSync } from "node:child_process";
import "dotenv/config";
import { Redis } from "ioredis";

// Runs once before the specs, against the local dev stack only.
export default async function globalSetup() {
  // the demo account (demo@leads.pk / password1) the specs log in as
  execFileSync("node", ["scripts/demo-user.mjs"], { stdio: "inherit" });

  // repeated runs from one machine would otherwise trip the signup/login limits
  const url = process.env.REDIS_URL;
  if (!url || process.env.NODE_ENV === "production") return;
  const redis = new Redis(url, { maxRetriesPerRequest: 2 });
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "ratelimit:*", "COUNT", 500);
    if (keys.length) await redis.del(...keys);
    cursor = next;
  } while (cursor !== "0");
  await redis.quit();
}
