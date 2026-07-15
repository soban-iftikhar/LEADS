import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

console.log("KEY LOADED:", process.env.GEMINI_API_KEY);

import { enhanceListingWithAi } from "@/lib/gemini";

async function test() {
  const result = await enhanceListingWithAi(
    "Beautiful 5 Marla House",
    "House",
    "A spacious and well-built house located in a prime area with all modern amenities nearby."
  );

  console.log("Gemini result:", JSON.stringify(result, null, 2));
}

test();