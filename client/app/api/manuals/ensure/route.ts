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

export async function POST(req: Request) {
    try {
        const { manufacturer, model, year } = await req.json();

        const { data: existing } = await supabase
            .from("manuals")
            .select("*")
            .eq("manufacturer", manufacturer)
            .eq("model", model)
            .eq("year", year)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ manual: existing });
        }

        const prompt = `
אנא החזר לי אובייקט JSON שמתאים לרכב מסוג ${manufacturer} ${model} שנה ${year}
המבנה צריך להיות:
{
  "tire_pressure_front": "xx psi",
  "tire_pressure_rear": "xx psi",
  "tire_instructions": "",
  "oil_type": "",
  "oil_instructions": "",
  "coolant_type": ""
}
אם אתה לא יודע, שים ערך ריק "".
החזר אך ורק JSON תקין וללא טקסט נוסף.
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

        const { data: saved } = await supabase
            .from("manuals")
            .upsert({
                manufacturer,
                model,
                year,
                tire_pressure_front: parsed.tire_pressure_front ?? "",
                tire_pressure_rear: parsed.tire_pressure_rear ?? "",
                tire_instructions: parsed.tire_instructions ?? "",
                oil_type: parsed.oil_type ?? "",
                oil_instructions: parsed.oil_instructions ?? "",
                coolant_type: parsed.coolant_type ?? "",
            })
            .select("*")
            .single();

        return NextResponse.json({ manual: saved });
    } catch (err) {
        console.error("שגיאה ב־/api/manuals/ensure:", err);
        return NextResponse.json(
            {
                error: "שגיאה בצד שרת",
                message: err instanceof Error ? err.message : String(err),
            },
            { status: 500 }
        );
    }
}


