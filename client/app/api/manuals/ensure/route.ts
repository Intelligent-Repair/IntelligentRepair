import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase env vars (URL or SERVICE_ROLE_KEY)");
  }

  return createClient(url, serviceRoleKey);
}

// ניקוי ערכים חשודים
function clean(value?: string) {
    return value?.toLowerCase().includes("empty") ? "" : value?.trim() || "";
}

// פונקציית עזר לפנייה ל־GPT
async function askGPT(prompt: string): Promise<string> {
    const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
    });

    return res.choices[0]?.message?.content ?? "";
}

export async function POST(req: Request) {
    try {
        const supabase = getSupabase();
        const body = await req.json();

        const manufacturer = body.manufacturer?.trim();
        const model = body.model?.trim().replace(/\s+/g, " ");
        const year = Number(body.year);

        console.log("🔍 מחפש עבור:", manufacturer, model, year);

        // בדיקה אם כבר קיים manual
        const { data: existing } = await supabase
            .from("manuals")
            .select("*")
            .ilike("manufacturer", manufacturer)
            .ilike("model", model)
            .eq("year", year)
            .maybeSingle();

        if (existing) {
            console.log("✅ נמצא ב־Supabase");
            return NextResponse.json({ manual: existing });
        }

        // הכנת הפרומפט
        const prompt = `
החזר אך ורק אובייקט JSON תקין שמתאר ספר רכב עבור רכב מסוג ${manufacturer} ${model} משנת ${year} (בלי טקסט נוסף):

{
  "tire_pressure_front": "xx psi",
  "tire_pressure_rear": "xx psi",
  "tire_instructions": "כתוב בעברית בלבד על בדיקות לחץ אוויר",
  "oil_type": "סוג שמן מומלץ",
  "oil_instructions": "כתוב בעברית בלבד מתי ואיך להחליף שמן",
  "coolant_type": "סוג נוזל קירור"
}

אם אתה לא יודע ערך מסוים — החזר מחרוזת ריקה "".
אל תשתמש ב־\\ או תווי בריחה.
`;

        // ניסיון ראשון
        let content = await askGPT(prompt);

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            console.warn("⚠️ ניסיון ראשון כשל, מנסה שוב...");
            // ניסיון שני
            content = await askGPT(prompt + "\n\nהחזר אך ורק JSON תקין בלי הסברים.");
            try {
                parsed = JSON.parse(content);
            } catch {
                console.error("❌ גם ניסיון שני נכשל:", content);
                return NextResponse.json(
                    {
                        manual: null,
                        source: "gpt_failed_twice",
                    },
                    { status: 200 } // לא נכשלים - מחזירים תשובה ריקה
                );
            }
        }

        // שמירה ל־Supabase עם ניקוי
        const { data: saved, error: insertError } = await supabase
            .from("manuals")
            .upsert({
                manufacturer,
                model,
                year,
                tire_pressure_front: clean(parsed.tire_pressure_front),
                tire_pressure_rear: clean(parsed.tire_pressure_rear),
                tire_instructions: clean(parsed.tire_instructions),
                oil_type: clean(parsed.oil_type),
                oil_instructions: clean(parsed.oil_instructions),
                coolant_type: clean(parsed.coolant_type),
            })
            .select("*")
            .single();

        if (insertError) {
            // טיפול בכפילות (שתי בקשות במקביל)
            if (insertError.message.includes("duplicate key value")) {
                console.warn("⚠️ ניסיון כפול לשמירה – שולף מחדש מה־DB");

                const { data: retry } = await supabase
                    .from("manuals")
                    .select("*")
                    .ilike("manufacturer", manufacturer)
                    .ilike("model", model)
                    .eq("year", year)
                    .maybeSingle();

                return NextResponse.json({ manual: retry });
            }

            // שגיאה אמיתית אחרת
            console.error("❌ שגיאה בשמירה:", insertError.message);
            return NextResponse.json(
                { error: "שמירה נכשלה", message: insertError.message },
                { status: 500 }
            );
        }


        console.log("✅ manual נשמר בהצלחה");
        return NextResponse.json({ manual: saved });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
        console.error("❌ שגיאה כללית:", message);
        return NextResponse.json(
            { error: "שגיאה בצד שרת", message },
            { status: 500 }
        );
    }
}




