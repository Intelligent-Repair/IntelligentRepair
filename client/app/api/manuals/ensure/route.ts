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

        // הכנת הפרומפט - משופר לקבלת נתונים מאומתים
        const prompt = `
אתה מומחה טכני לרכב שמשתמש אך ורק בנתונים רשמיים מספר הרכב (Owner's Manual) של היצרן.

החזר אובייקט JSON **תקין בלבד** עם מפרט טכני עבור רכב:
יצרן: ${manufacturer}
דגם: ${model}
שנת ייצור: ${year}

**חשוב מאוד:**
1. השתמש רק בנתונים מאומתים מספר הרכב הרשמי של היצרן
2. אם אינך בטוח ב-100% בערך מסוים - החזר מחרוזת ריקה ""
3. לחץ אוויר צריך להיות ב-PSI בלבד (לדוגמה: "32 PSI")
4. סוג השמן חייב לכלול צמיגות מלאה (לדוגמה: "5W-30 סינתטי מלא")
5. צבע נוזל קירור - ציין את הצבע הספציפי (ירוק, ורוד, כתום, אדום, כחול וכו')
6. סוג נוזל קירור - ציין את הסטנדרט המדויק (G12+, OAT, HOAT, IAT וכו')
7. מידות צמיגים - פורמט סטנדרטי (לדוגמה: "205/55R16")
8. נפח מיכל דלק - בליטרים (לדוגמה: "50 ליטר")
9. מגבים - מידות באינצ'ים (לדוגמה: "24\" + 18\"" או "26\"")
10. מצבר - מפרט מלא כולל קיבולת (לדוגמה: "12V 60Ah 540A")

{
  "tire_pressure_front": "לחץ אוויר קדמי ב-PSI",
  "tire_pressure_rear": "לחץ אוויר אחורי ב-PSI",
  "tire_size_front": "מידת צמיג קדמי (לדוגמה: 205/55R16)",
  "tire_size_rear": "מידת צמיג אחורי (לדוגמה: 205/55R16)",
  "tire_instructions": "הוראות קצרות בעברית לבדיקת צמיגים",
  "oil_type": "סוג שמן מנוע מדויק עם צמיגות",
  "oil_instructions": "הוראות קצרות בעברית להחלפת שמן",
  "coolant_type": "סוג/סטנדרט נוזל קירור",
  "coolant_color": "צבע נוזל הקירור המקורי",
  "coolant_instructions": "הוראות קצרות בעברית לבדיקת מפלס נוזל קירור",
  "fuel_type": "סוג דלק (בנזין 95/98, דיזל, היברידי וכו')",
  "fuel_tank_capacity": "נפח מיכל דלק בליטרים",
  "wipers_front": "מידות מגבים קדמיים באינצ'ים (נהג + נוסע)",
  "wiper_rear": "מידת מגב אחורי באינצ'ים (אם קיים)",
  "battery_specs": "מפרט מצבר (מתח, קיבולת, זרם התנעה)"
}

אל תמציא נתונים. אם אין לך מידע מהימן מספר הרכב הרשמי - החזר מחרוזת ריקה "".
אל תשתמש ב־\\ או תווי בריחה.
`;

        // ניסיון ראשון
        let content = await askGPT(prompt);

        // ניקוי תגובה מ-GPT - הסרת markdown code blocks אם יש
        const cleanJsonResponse = (text: string): string => {
            // הסרת ```json ... ``` או ``` ... ```
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                return jsonMatch[1].trim();
            }
            return text.trim();
        };

        let parsed;
        try {
            parsed = JSON.parse(cleanJsonResponse(content));
        } catch {
            console.warn("⚠️ ניסיון ראשון כשל, מנסה שוב...");
            // ניסיון שני
            content = await askGPT(prompt + "\n\nהחזר אך ורק JSON תקין בלי הסברים ובלי markdown.");
            try {
                parsed = JSON.parse(cleanJsonResponse(content));
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
        // שימוש ב-onConflict כדי לעדכן רשומה קיימת במקום לזרוק שגיאה
        const { data: saved, error: insertError } = await supabase
            .from("manuals")
            .upsert({
                manufacturer,
                model,
                year,
                tire_pressure_front: clean(parsed.tire_pressure_front),
                tire_pressure_rear: clean(parsed.tire_pressure_rear),
                tire_size_front: clean(parsed.tire_size_front),
                tire_size_rear: clean(parsed.tire_size_rear),
                tire_instructions: clean(parsed.tire_instructions),
                oil_type: clean(parsed.oil_type),
                oil_instructions: clean(parsed.oil_instructions),
                coolant_type: clean(parsed.coolant_type),
                coolant_color: clean(parsed.coolant_color),
                coolant_instructions: clean(parsed.coolant_instructions),
                fuel_type: clean(parsed.fuel_type),
                fuel_tank_capacity: clean(parsed.fuel_tank_capacity),
                wipers_front: clean(parsed.wipers_front),
                wiper_rear: clean(parsed.wiper_rear),
                battery_specs: clean(parsed.battery_specs),
            }, {
                onConflict: 'manufacturer,model,year', // התאמה ל-UNIQUE constraint
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




