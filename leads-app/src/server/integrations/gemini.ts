import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/server/env";

let client: GoogleGenAI | undefined;

// Created on first use, so importing this module needs no API key (build, tests).
function gemini(): GoogleGenAI | null {
  const { GEMINI_API_KEY } = env();
  if (!GEMINI_API_KEY) return null;
  client ??= new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return client;
}

const reply = z.object({ description: z.string().min(1).max(4000), category: z.enum(["HOUSE", "PLOT", "FLAT", "COMMERCIAL"]) });
export type DescriptionSuggestion = z.infer<typeof reply>;

/**
 * A clearer rewrite of an owner's description, and the category the text fits best. Never adds
 * facts. Returns null when AI is not configured or the answer is unusable; callers then keep the
 * owner's own text.
 */
export async function suggestDescription(input: { title: string; category: string; locality: string; description: string }): Promise<DescriptionSuggestion | null> {
  const ai = gemini();
  if (!ai) return null;
  const prompt = `You improve property listings on a Pakistani real estate site.

Listing: ${JSON.stringify(input)}

Rewrite "description" to be clear and appealing to buyers, in plain English, under 120 words.
Use only facts present in the input; never invent rooms, amenities, prices or places.
Pick the category that fits best: HOUSE, PLOT, FLAT or COMMERCIAL.
Answer with JSON only: {"description": string, "category": string}`;
  try {
    const result = await ai.models.generateContent({ model: env().GEMINI_MODEL, contents: prompt, config: { responseMimeType: "application/json" } });
    const parsed = reply.safeParse(JSON.parse((result.text ?? "").trim()));
    return parsed.success ? parsed.data : null;
  } catch (e) {
    console.error("[gemini] description suggestion failed:", String(e).slice(0, 300));
    return null;
  }
}
