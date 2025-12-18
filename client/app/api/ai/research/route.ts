/**
 * Research API route (optional - for initial analysis)
 * 
 * NOTE: According to new spec, vehicle info should NOT be sent to API
 * This endpoint is kept for backward compatibility but vehicle info is ignored
 */

import { NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/ai/client";
import { extractJSON } from "../aiUtils";
import { buildResearchPrompt } from "@/lib/ai/prompt-builder";

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

    const client = createOpenAIClient(apiKey, "gpt-4o", {
      responseFormat: { type: "json_object" },
    });

    // Build prompt without vehicle info (according to new spec)
    const prompt = buildResearchPrompt(description);

    console.log("[Research API] Calling OpenAI with description length:", description?.length || 0);
    
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

    return NextResponse.json(
      {
        top_causes: parsed.top_causes ?? [],
        differentiating_factors: parsed.differentiating_factors ?? [],
        summary: parsed.reasoning ?? parsed.summary ?? "Analysis summary unavailable.",
        raw: raw,
        reasoning: parsed.reasoning ?? "Analysis summary unavailable.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Research API] Error:", err);
    return NextResponse.json(fallbackResearch(), { status: 200 });
  }
}
