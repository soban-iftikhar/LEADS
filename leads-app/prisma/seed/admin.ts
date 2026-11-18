// Development data for the admin console, loaded from the JSON fixtures in prisma/seed/admin/.
// Idempotent: every row is upserted by a natural key, so it can be re-run at any time.
//
//   npm run db:seed:admin      (after `python scripts/seed_config.py` and `npm run db:seed:dev`)
//
// App code never imports this folder. It refuses to run in production.
import "dotenv/config";
import { createContext } from "./admin/context";
import { seedTeam } from "./admin/team";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed admin demo data in production.");
  process.exit(1);
}

const steps = [["team", seedTeam]] as const;

async function main() {
  const ctx = createContext();
  try {
    for (const [name, run] of steps) console.log(`${name}: ${await run(ctx)}`);
  } finally {
    await ctx.prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
