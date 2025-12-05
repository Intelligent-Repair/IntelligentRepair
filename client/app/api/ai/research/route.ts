import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function extractJSON(text: string): any | null {
  if (!text || typeof text !== "string") return null;

  let cleaned = text.trim().replace(/^```(?:json)?/gm, "").replace(/```$/gm, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  return null;
}

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
    const { description, vehicle } = await req.json();

    if (!description || !vehicle) {
      return NextResponse.json(fallbackResearch(), { status: 200 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallbackResearch(), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
בצע חקירה עמוקה של התקלה לפי תיאור המשתמש.

תיאור:
"${description}"

רמזים פנימיים לאבחון:
- תקלות נפוצות בדגם דומה
- דיווחים ממוסכים
- TSBs ידועים
- סימפטומים דומים

החזר JSON בלבד:
{
  "top_causes": ["...", "..."],
  "differentiating_factors": ["...", "..."],
  "reasoning": "..."
}
`;

    console.log("[Research API] Calling Gemini with description length:", description?.length || 0);
    
    let raw: string;
    try {
      const result = await model.generateContent(prompt);
      raw = result.response.text();
      
      console.log("[Research API] Raw response length:", raw?.length || 0);
      console.log("[Research API] Raw response preview:", raw?.substring(0, 200) || "No response");
    } catch (geminiError: any) {
      console.error("[Research API] Gemini API call failed:", geminiError);
      console.error("[Research API] Gemini error message:", geminiError?.message);
      // Use fallback on Gemini API failure
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
    console.error("[Research API] Error message:", (err as any)?.message);
    console.error("[Research API] Error stack:", (err as any)?.stack);
    return NextResponse.json(fallbackResearch(), { status: 200 });
  }
}
