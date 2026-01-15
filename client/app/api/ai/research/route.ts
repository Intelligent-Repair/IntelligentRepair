/**
 * Research API route (optional - for initial analysis)
 * 
 * NOTE: According to new spec, vehicle info should NOT be sent to API
 * This endpoint is kept for backward compatibility but vehicle info is ignored
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAIClient } from "@/lib/ai/client";
import { extractJSON } from "../aiUtils";
import { buildResearchPrompt } from "@/lib/ai/prompt-builder";

// Research model - using mini for cost optimization
const RESEARCH_MODEL = "gpt-4o-mini";

// Strict Zod schema for research response validation
const ResearchResponseSchema = z.object({
  top_causes: z.array(z.string()).min(1),
  differentiating_factors: z.array(z.string()).min(1),
  reasoning: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  keywords: z.array(z.string()).min(3).max(5),
});

function fallbackResearch() {
  return {
    top_causes: [
      "תקלה כללית במערכת ההצתה",
      "בעיה אפשרית במערכת הדלק",
      "כשל בחיישן קריטי",
    ],
    differentiating_factors: [
      "האם קיימת ירידה פתאומית בביצועים",
      "האם התקלה מחמירה תחת עומס",
      "האם נשמעים רעשים חריגים",
    ],
    summary: "הממצאים מבוססים על ניתוח כללי של תקלות נפוצות. מומלץ להמשיך בתהליך האבחון.",
    raw: "",
    reasoning: "הממצאים מבוססים על ניתוח כללי של תקלות נפוצות. מומלץ להמשיך בתהליך האבחון.",
    severity: "medium" as const,
    keywords: ["תקלה כללית", "מערכת", "אבחון"],
  };
}

export async function POST(req: Request) {
  try {
    const { description } = await req.json();

    if (!description?.trim()) {
      return NextResponse.json(fallbackResearch(), { status: 200 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallbackResearch(), { status: 200 });
    }

    // Use gpt-4o-mini for cost optimization and set low temperature for deterministic output
    const client = createOpenAIClient(apiKey, RESEARCH_MODEL, {
      responseFormat: { type: "json_object" },
      temperature: 0.2, // Low temperature for factual, consistent research output
    });

    // Build prompt without vehicle info (according to new spec)
    const prompt = buildResearchPrompt(description);

    console.log("[Research API] Calling OpenAI with description length:", description?.length || 0);
    console.log("[Research API] Using model:", RESEARCH_MODEL, "with temperature: 0.2");
    
    let raw: string;
    try {
      raw = await client.generateContent(prompt);
      
      console.log("[Research API] Raw response length:", raw?.length || 0);
      console.log("[Research API] Raw response preview:", raw?.substring(0, 200) || "No response");
    } catch (openaiError: any) {
      console.error("[Research API] OpenAI API call failed:", openaiError);
      return NextResponse.json(fallbackResearch(), { status: 200 });
    }
    
    const parsed = extractJSON(raw);
    
    console.log("[Research API] Parsed JSON:", parsed ? "Success" : "Failed");

    if (!parsed || typeof parsed !== "object") {
      console.warn("[Research API] JSON extraction failed, using fallback");
      return NextResponse.json(fallbackResearch(), { status: 200 });
    }

    // Strict validation using Zod schema
    const validationResult = ResearchResponseSchema.safeParse(parsed);
    
    if (!validationResult.success) {
      // ZodError exposes details under `.issues` (not `.errors`)
      console.error("[Research API] Zod validation failed:", validationResult.error.issues);
      console.error("[Research API] Invalid response structure, using fallback");
      return NextResponse.json(fallbackResearch(), { status: 200 });
    }

    const validated = validationResult.data;

    return NextResponse.json(
      {
        top_causes: validated.top_causes,
        differentiating_factors: validated.differentiating_factors,
        summary: validated.reasoning,
        raw: raw,
        reasoning: validated.reasoning,
        severity: validated.severity,
        keywords: validated.keywords,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Research API] Error:", err);
    return NextResponse.json(fallbackResearch(), { status: 200 });
  }
}
