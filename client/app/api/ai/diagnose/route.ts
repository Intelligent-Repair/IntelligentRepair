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

export async function POST(req: Request) {
  try {
    const { description, vehicle, answers } = await req.json();

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!vehicle || !vehicle.manufacturer || !vehicle.model) {
      return NextResponse.json(
        { error: "Vehicle information is required" },
        { status: 400 }
      );
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "Answers are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service configuration error" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
You are a professional automotive technician assistant.

Vehicle:
Manufacturer: ${vehicle.manufacturer}
Model: ${vehicle.model}
Year: ${vehicle.year || "Unknown"}
Plate: ${vehicle.license_plate || "Unknown"}

User problem description:
"${description}"

User answers to diagnostic yes/no questions:
${JSON.stringify(answers, null, 2)}

Provide the following:

1. "diagnosis" — list 3–6 possible causes.
2. "self_checks" — 3 safe steps a regular person can do at home.
3. "warnings" — safety notes.
4. "disclaimer" — explain that diagnosis may be inaccurate.

Return ONLY valid JSON:
{
  "diagnosis": [...],
  "self_checks": [...],
  "warnings": [...],
  "disclaimer": "..."
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const diagnosis = extractJSON(text);

    if (!diagnosis || typeof diagnosis !== "object") {
      return NextResponse.json(
        {
          diagnosis: ["Unable to parse diagnosis. Professional inspection recommended."],
          self_checks: [],
          warnings: ["If unusual symptoms are present, stop driving immediately"],
          disclaimer: "This information is preliminary only and is not a substitute for professional inspection.",
        },
        { status: 200 }
      );
    }

    if (!diagnosis.diagnosis || !Array.isArray(diagnosis.diagnosis)) {
      diagnosis.diagnosis = [];
    }
    if (!diagnosis.self_checks || !Array.isArray(diagnosis.self_checks)) {
      diagnosis.self_checks = [];
    }
    if (!diagnosis.warnings || !Array.isArray(diagnosis.warnings)) {
      diagnosis.warnings = [];
    }
    if (!diagnosis.disclaimer || typeof diagnosis.disclaimer !== "string") {
      diagnosis.disclaimer = "אבחון זה הוא הערכה בלבד ואינו תחליף לבדיקה מקצועית במוסך.";
    }

    return NextResponse.json(diagnosis);
  } catch (err: any) {
    console.error("AI Diagnose Error:", err);
    return NextResponse.json(
      {
        diagnosis: ["AI diagnosis generation failed. Professional inspection recommended."],
        self_checks: [],
        warnings: ["If unusual symptoms are present, stop driving immediately"],
        disclaimer: "This information is preliminary only and is not a substitute for professional inspection.",
      },
      { status: 500 }
    );
  }
}
