import { execFileSync } from "node:child_process";
import "dotenv/config";
import { Redis } from "ioredis";

// Runs once before the specs, against the local dev stack only.
export default async function globalSetup() {
  // the demo accounts (demo@leads.pk, owner@leads.pk / password1) and their data
  execFileSync("npm", ["run", "--silent", "db:seed:dev"], { stdio: "inherit" });

  // repeated runs from one machine would otherwise trip the signup/login limits
  const url = process.env.REDIS_URL;
  if (!url || process.env.NODE_ENV === "production") return;
  const redis = new Redis(url, { maxRetriesPerRequest: 2 });
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "rl:*", "COUNT", 500);
    if (keys.length) await redis.del(...keys);
    cursor = next;
  } while (cursor !== "0");
  await redis.quit();
}
