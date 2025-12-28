import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CarRow = {
  id: string;
  user_id: string;
  license_plate: string | null;
  remind_winter: boolean | null;
  winter_last_sent_at: string | null;
  users: {
    email: string | null;
    full_name: string | null;
  } | null;
  vehicle_catalog: {
    manufacturer: string | null;
    model: string | null;
    year: number | null;
  } | null;
};

const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase env vars (URL or SERVICE_ROLE_KEY)");
  }
  return createClient(url, serviceRoleKey);
}

function isAuthorized(req: Request) {
  if (!CRON_SECRET) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token && token === CRON_SECRET;
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "IntelligentRepair <no-reply@intelligentrepair.app>",
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

function formatCar(row: CarRow) {
  const maker = row.vehicle_catalog?.manufacturer?.trim();
  const model = row.vehicle_catalog?.model?.trim();
  const plate = row.license_plate?.trim();
  const main = [maker, model].filter(Boolean).join(" ") || plate || "הרכב שלך";
  return { main, plate };
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const now = new Date();
    const currentYear = now.getUTCFullYear();

    const { data, error } = await supabase
      .from("people_cars")
      .select(
        `
          id,
          user_id,
          license_plate,
          remind_winter,
          winter_last_sent_at,
          users ( email, full_name ),
          vehicle_catalog:vehicle_catalog_id ( manufacturer, model, year )
        `
      )
      .eq("remind_winter", true);

    if (error) {
      console.error("[cron/winter] supabase error", error);
      return NextResponse.json({ error: "db_error", details: error.message }, { status: 500 });
    }

    const rows = (data || []) as unknown as CarRow[];
    const results: { id: string; status: "sent" | "skipped" | "failed"; reason?: string }[] = [];

    for (const row of rows) {
      const userEmail = row.users?.email?.trim();
      if (!userEmail) {
        results.push({ id: row.id, status: "skipped", reason: "no_email" });
        continue;
      }

      // Prevent duplicate per year
      if (row.winter_last_sent_at) {
        const sentYear = new Date(row.winter_last_sent_at).getUTCFullYear();
        if (sentYear === currentYear) {
          results.push({ id: row.id, status: "skipped", reason: "already_sent_this_year" });
          continue;
        }
      }

      const { main, plate } = formatCar(row);
      const subject = "תזכורת חורף – הכנת הרכב לעונה הקרה";
      const text = `שלום,

החורף מתקרב. זה הזמן לבדוק נורות, מגבים, צמיגים ונוזל קירור עבור ${main}${plate ? ` (לוחית ${plate})` : ""}.

מומלץ לוודא לחץ אוויר מתאים לחורף ולהחליף מגבים במידת הצורך.`;

      try {
        await sendEmail(userEmail, subject, text);
        await supabase
          .from("people_cars")
          .update({ winter_last_sent_at: now.toISOString() })
          .eq("id", row.id);
        results.push({ id: row.id, status: "sent" });
      } catch (err) {
        console.error("[cron/winter] send failed", err);
        results.push({ id: row.id, status: "failed", reason: (err as Error).message });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[cron/winter] fatal error", err);
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}

// Allow Vercel Cron (GET) to hit this route as well
export async function GET(req: Request) {
  return POST(req);
}

