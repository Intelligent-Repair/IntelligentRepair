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

// Helper to fetch image and convert to base64
async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    
    // Detect mime type from content-type header or URL extension
    let mimeType = response.headers.get("content-type") || "";
    
    if (!mimeType.startsWith("image/")) {
      // Fallback: detect from URL extension
      const urlLower = url.toLowerCase();
      if (urlLower.includes(".png")) {
        mimeType = "image/png";
      } else if (urlLower.includes(".webp")) {
        mimeType = "image/webp";
      } else if (urlLower.includes(".gif")) {
        mimeType = "image/gif";
      } else {
        mimeType = "image/jpeg"; // Default fallback
      }
    } else {
      // Normalize common image types
      if (mimeType === "image/jpg") {
        mimeType = "image/jpeg";
      }
    }
    
    return { data: base64, mimeType };
  } catch {
    return null;
  }
}

// Build prompt for draft consultation with images
function buildDraftPrompt(
  vehicle: { manufacturer: string; model: string; year?: string | number | null },
  description: string,
  imageCount: number,
  history?: any[]
): string {
  const yearText = vehicle.year ? `, Year: ${vehicle.year}` : "";
  const historyText = history && history.length > 0
    ? `\nPrevious conversation history:\n${JSON.stringify(history, null, 2)}`
    : "";

  return `אתה עוזר מקצועי למוסכניק רכב המנתח פנייה לתיקון רכב.

הוראות מערכת:
המשתמש העלה ${imageCount} תמונה/ות עם הפנייה הזו. התמונות מסופקות לך כנתוני תמונה מובנים בבקשה הזו. אתה חובה לנתח את התמונות קודם לפני שאתה מגיב. אל תשאל שאלות שהתשובות להן נראות בבירור בתמונות.

מידע על הרכב:
- יצרן: ${vehicle.manufacturer}
- דגם: ${vehicle.model}${yearText}

תיאור הבעיה של המשתמש:
"${description}"

${historyText}

הוראות קריטיות - בצע לפי הסדר:

1. ניתוח תמונות (שלב חובה ראשון - עשה זאת לפני כל דבר אחר):
   - בדוק בקפידה את כל ${imageCount} התמונה/ות שהועלו
   - זהה את כל המידע הנראה בתמונות:
     * צבע הרכב, מצב חיצוני
     * נורות אזהרה (צבע, סמלים, טקסט בלוח מחוונים)
     * הודעות שגיאה או קודים הנראים על המסכים
     * מצב רכיבים (צמיגים, תא מנוע, נזק, בלאי)
     * פגמים נראים, דליפות, או חריגות
     * כל טקסט, תוויות, או אינדיקטורים הנראים בתמונות
   - חלץ את כל העובדות הנצפות מהתמונות
   - שים לב לפרטים ספציפיים: צבעים מדויקים, טקסט מדויק, סמלים מדויקים, מיקומים מדויקים

2. כללי הימנעות משאלות (קריטי - אכוף בקפדנות):
   - אם צבע נורת האזהרה נראה בתמונות → אל תשאל "איזה צבע הנורה?" - ציין את הצבע שאתה רואה
   - אם סמל/טקסט של נורת אזהרה נראה → אל תשאל עליו - תאר מה שאתה רואה
   - אם צבע הרכב נראה → אל תשאל על צבע
   - אם נזק/בלאי נראה → אל תשאל אם יש נזק - התייחס למה שאתה רואה ישירות
   - אם חלקים/רכיבים ספציפיים נראים → התייחס אליהם ישירות, אל תשאל על נוכחותם
   - אם כל תשובה יכולה להיקבע מניתוח התמונה → אל תשאל את השאלה הזו
   - לעולם אל תשאל על תכונות שנראות בבירור בתמונות שסופקו

3. החלטת תגובה:
   - אם ניתוח התמונות + התיאור מספקים מידע מספיק (ביטחון >= 0.8): החזר אבחון מיד
   - אם נדרש מידע נוסף (ביטחון < 0.8): שאל שאלת המשך ממוקדת אחת על מידע שלא נראה בתמונות

4. הנחיות לשאלות (רק אם שואל שאלה):
   - חייבת להיות סגורה (כן/לא) או בחירה מרובת (3-5 אפשרויות)
   - חייבת להתמקד במידע שלא ניתן לקבוע מהתמונות
   - חייבת להיות ספציפית וניתנת לפעולה
   - דוגמאות לשאלות תקפות: "מתי זה קורה?" (תזמון), "האם זה קורה בזמן נסיעה?" (התנהגות), "כמה זמן זה קורה?" (משך), "האם הבעיה מתרחשת במהירויות ספציפיות?" (התנהגות שלא נראית בתמונות סטטיות)

5. הנחיות לאבחון (אם מספק אבחון):
   - התייחס לתצפיות ספציפיות מהתמונות בהודעה שלך
   - היה מפורש: "אני רואה בתמונה ש..." או "התמונה מראה..."
   - בס את ההערכה שלך גם על התיאור וגם על הראיות החזותיות
   - היה ספציפי על מה שאתה רואה: צבעים מדויקים, טקסט מדויק, סמלים מדויקים

6. פורמט פלט (חובה):
החזר רק JSON תקין בפורמט המדויק הזה (ללא markdown, ללא בלוקי קוד, רק JSON גולמי):
{
  "type": "question" | "diagnosis",
  "message": "string",
  "options": ["option1", "option2", ...] (רק אם type הוא "question"),
  "confidence": מספר בין 0 ל-1
}

אם type הוא "question", כלול מערך "options" עם 2-5 אפשרויות.
אם type הוא "diagnosis", "options" צריך להישמט.
תמיד כלול "confidence" כמספר בין 0 ל-1.

חשוב מאוד:
- כל התגובות שלך חייבת להיות בעברית
- השתמש במשפטים קצרים
- טון רגוע ומקצועי של מוסכניק מנוסה
- החזר תגובות דטרמיניסטיות ועקביות המבוססות על הראיות החזותיות`;
}

export async function POST(req: Request) {
  let isDraftConsultation = false;
  
  try {
    const body = await req.json();
    console.log("[ai/diagnose] incoming body:", body);
    console.log("[ai/diagnose] image_urls:", body?.image_urls, "count=", body?.image_urls?.length);
    
    const { description, vehicle, answers, image_urls, history } = body;

    // Validate description
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    // Validate vehicle
    if (!vehicle || !vehicle.manufacturer || !vehicle.model) {
      return NextResponse.json(
        { error: "Vehicle information is required" },
        { status: 400 }
      );
    }

    // Determine if this is a draft consultation (has image_urls, no answers required)
    isDraftConsultation = Array.isArray(image_urls) && image_urls.length > 0;
    
    // For existing flow: answers are required
    if (!isDraftConsultation) {
      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        return NextResponse.json(
          { error: "Answers are required" },
          { status: 400 }
        );
      }
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
        temperature: 0.3, // Lower temperature for more deterministic responses
      },
    });

    // Handle draft consultation flow with images
    if (isDraftConsultation) {
      const validImageUrls = image_urls
        .filter((url: any) => typeof url === "string" && url.trim().length > 0)
        .slice(0, 3); // Limit to 3 images

      console.log("[ai/diagnose] Processing", validImageUrls.length, "image(s)");

      // Fetch all images first and build multimodal content parts
      const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
      
      for (const url of validImageUrls) {
        const imageData = await fetchImageAsBase64(url);
        if (imageData) {
          imageParts.push({
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          });
          console.log("[ai/diagnose] Successfully fetched image, mimeType:", imageData.mimeType);
        } else {
          console.warn("[ai/diagnose] Failed to fetch image from URL:", url);
        }
      }

      // Build prompt with image count (not URLs)
      const prompt = buildDraftPrompt(vehicle, description.trim(), imageParts.length, history);

      // Build multimodal content: text part first, then all image parts
      const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt },
        ...imageParts,
      ];

      console.log("[ai/diagnose] Sending multimodal request with", contentParts.length, "parts (1 text +", imageParts.length, "images)");

      const result = await model.generateContent(contentParts);
      const text = result.response.text();
      const response = extractJSON(text);

      // Validate and normalize draft consultation response
      if (!response || typeof response !== "object") {
        return NextResponse.json(
          {
            type: "question",
            message: "אני צריך מידע נוסף כדי לעזור לאבחן את הבעיה. תוכל לתאר מתי הבעיה מתרחשת?",
            options: ["בזמן נסיעה", "בהפעלת המנוע", "בסרק", "אחר"],
            confidence: 0.3,
          },
          { status: 200 }
        );
      }

      // Normalize response format
      const normalized: any = {
        type: response.type === "diagnosis" ? "diagnosis" : "question",
        message: typeof response.message === "string" && response.message.trim()
          ? response.message.trim()
          : response.type === "diagnosis"
            ? "תבסס על המידע שסופק, הנה ההערכה שלי."
            : "תוכל לספק פרטים נוספים על הבעיה?",
        confidence: typeof response.confidence === "number" && !isNaN(response.confidence)
          ? Math.max(0, Math.min(1, response.confidence))
          : 0.5,
      };

      // Add options only for questions
      if (normalized.type === "question") {
        if (Array.isArray(response.options) && response.options.length >= 2) {
          normalized.options = response.options
            .filter((opt: any) => typeof opt === "string" && opt.trim())
            .slice(0, 5);
        } else {
          normalized.options = ["כן", "לא"];
        }
      }

      return NextResponse.json(normalized);
    }

    // Existing flow: diagnosis with answers (no images)
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
    
    if (isDraftConsultation) {
      return NextResponse.json(
        {
          type: "question",
          message: "נתקלתי בשגיאה בעיבוד הבקשה שלך. תוכל לספק פרטים נוספים על הבעיה?",
          options: ["כן, אני יכול לספק פרטים נוספים", "לא, זה כל מה שיש לי"],
          confidence: 0.3,
        },
        { status: 500 }
      );
    }
    
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
