import { GoogleGenAI } from "@google/genai";

// Created lazily (inside the function, not here at module load time) so
// that whichever env-loading mechanism is in use (Next.js, dotenv in a
// script, etc.) has already run by the time we actually need the key.
let ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return ai;
}

const VALID_CATEGORIES = [
  "House",
  "Apartment",
  "Plot",
  "Commercial",
  "Farmhouse",
  "Room",
];

export interface AiReviewResult {
  enhancedDescription: string;
  suggestedCategory: string;
  categoryMatches: boolean;
}

export async function enhanceListingWithAi(
  title: string,
  category: string,
  description: string
): Promise<AiReviewResult | null> {
  try {
    const prompt = `You are reviewing a real estate listing for a property platform in Pakistan.

Title: ${title}
Seller-selected category: ${category}
Valid categories: ${VALID_CATEGORIES.join(", ")}
Original description: ${description}

Tasks:
1. Rewrite the description to be clearer, more professional, and more appealing to buyers. Do NOT invent facts (like number of rooms, amenities, or location details) that are not already stated or clearly implied in the original description.
2. Based on the title and description, determine which category from the valid list actually fits best. It may or may not match the seller-selected category.

Respond with ONLY valid JSON, no markdown formatting, no extra text, in this exact shape:
{
  "enhancedDescription": "string",
  "suggestedCategory": "one of the valid categories",
  "categoryMatches": true or false
}`;

    const result = await getClient().models.generateContent({
  model: "gemini-flash-latest",
      contents: prompt,
    });
    const rawText = (result.text ?? "").trim();

    const cleaned = rawText.replace(/^```json\s*|\s*```$/g, "");

    const parsed = JSON.parse(cleaned) as AiReviewResult;

    if (
      typeof parsed.enhancedDescription !== "string" ||
      typeof parsed.suggestedCategory !== "string" ||
      typeof parsed.categoryMatches !== "boolean"
    ) {
      throw new Error("Gemini response missing expected fields");
    }

    return parsed;
  } catch (error) {
    console.error("Gemini enhancement error:", error);
    return null;
  }
}