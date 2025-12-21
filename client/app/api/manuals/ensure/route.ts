import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

function clean(value?: string) {
    return value?.toLowerCase().includes("empty") ? "" : value?.trim() || "";
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // ניקוי נתונים לפני שימוש
        const manufacturer = body.manufacturer?.trim();
        const model = body.model?.trim().replace(/\s+/g, " ");
        const year = Number(body.year);

        // בדיקה אם כבר קיים ספר רכב כזה
        const { data: existing } = await supabase
            .from("manuals")
            .select("*")
            .ilike("manufacturer", manufacturer)
            .ilike("model", model)
            .eq("year", year)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ manual: existing });
        }

        console.log("🔍 מחפש עבור:", manufacturer, model, year);



        // הכנה ל־GPT עם פלט בעברית בלבד
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

        const gpt = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
        });

        const content = gpt.choices[0]?.message?.content ?? "{}";

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            return NextResponse.json(
                { error: "GPT החזיר תוכן לא תקין", raw: content },
                { status: 500 }
            );
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
            throw insertError;
        }

        return NextResponse.json({ manual: saved });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
        console.error("שגיאה ב־/api/manuals/ensure:", message);
        return NextResponse.json(
            {
                error: "שגיאה בצד שרת",
                message,
            },
            { status: 500 }
        );
    }

}



