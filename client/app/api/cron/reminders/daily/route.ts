import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CarRow = {
  id: string;
  user_id: string;
  license_plate: string | null;
  remind_tires: boolean | null;
  remind_oil_water: boolean | null;
  remind_test: boolean | null;
  remind_service: boolean | null;
  tires_started_at: string | null;
  tires_last_sent_at: string | null;
  oil_water_started_at: string | null;
  oil_water_last_sent_at: string | null;
  test_date: string | null;
  test_last_sent_at: string | null;
  service_date: string | null;
  service_last_sent_at: string | null;
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

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function isDueEveryNDays(
  startedAt: string | null,
  lastSentAt: string | null,
  intervalDays: number,
  now: Date
) {
  if (!startedAt) return false;
  const baseline = lastSentAt ? new Date(lastSentAt) : new Date(startedAt);
  return daysBetween(baseline, now) >= intervalDays - 0.01; // small tolerance
}

function isDue30DaysBefore(
  targetDate: string | null,
  lastSentAt: string | null,
  now: Date
) {
  if (!targetDate) return false;
  const target = new Date(targetDate + "T00:00:00Z");
  const daysToTarget = daysBetween(now, target);
  if (daysToTarget < 0) return false; // already passed
  if (daysToTarget > 30) return false;
  if (!lastSentAt) return true;
  const last = new Date(lastSentAt);
  return daysBetween(last, now) >= 25; // avoid spamming, allow ~once per month
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

    const { data, error } = await supabase
      .from("people_cars")
      .select(
        `
          id,
          user_id,
          license_plate,
          remind_tires,
          remind_oil_water,
          remind_test,
          remind_service,
          tires_started_at,
          tires_last_sent_at,
          oil_water_started_at,
          oil_water_last_sent_at,
          test_date,
          test_last_sent_at,
          service_date,
          service_last_sent_at,
          users ( email, full_name ),
          vehicle_catalog:vehicle_catalog_id ( manufacturer, model, year )
        `
      );

    if (error) {
      console.error("[cron/daily] supabase error", error);
      return NextResponse.json({ error: "db_error", details: error.message }, { status: 500 });
    }

    const rawRows = (data || []) as any[];
    const rows: CarRow[] = rawRows.map((r) => ({
      ...r,
      users: Array.isArray(r.users)
        ? r.users[0] ?? { email: null, full_name: null }
        : (r.users ?? { email: null, full_name: null }),
      vehicle_catalog: Array.isArray(r.vehicle_catalog)
        ? r.vehicle_catalog[0] ?? { manufacturer: null, model: null, year: null }
        : (r.vehicle_catalog ?? { manufacturer: null, model: null, year: null }),
    }));
    const results: { id: string; type: string; status: "sent" | "skipped" | "failed"; reason?: string }[] = [];

    for (const row of rows) {
      const userEmail = row.users?.email?.trim();
      if (!userEmail) {
        results.push({ id: row.id, type: "skip", status: "skipped", reason: "no_email" });
        continue;
      }

      const { main, plate } = formatCar(row);

      // Tires every 14 days
      if (row.remind_tires && isDueEveryNDays(row.tires_started_at, row.tires_last_sent_at, 14, now)) {
        const subject = "תזכורת בדיקת לחץ אוויר בצמיגים";
        const text = `שלום,

זה תזכורת לבדוק לחץ אוויר בצמיגים עבור ${main}${plate ? ` (לוחית ${plate})` : ""}.

מומלץ לבדוק ולהתאים לפי ספר הרכב.`;
        try {
          await sendEmail(userEmail, subject, text);
          await supabase.from("people_cars").update({ tires_last_sent_at: now.toISOString() }).eq("id", row.id);
          results.push({ id: row.id, type: "tires", status: "sent" });
        } catch (err) {
          console.error("[cron/daily] tires send failed", err);
          results.push({ id: row.id, type: "tires", status: "failed", reason: (err as Error).message });
        }
      }

      // Oil/Water every 14 days
      if (
        row.remind_oil_water &&
        isDueEveryNDays(row.oil_water_started_at, row.oil_water_last_sent_at, 14, now)
      ) {
        const subject = "תזכורת בדיקת שמן/מים";
        const text = `שלום,

זה תזכורת לבדוק שמן/מים עבור ${main}${plate ? ` (לוחית ${plate})` : ""}.

מומלץ לוודא מפלס שמן ונוזל קירור לפי ספר הרכב.`;
        try {
          await sendEmail(userEmail, subject, text);
          await supabase
            .from("people_cars")
            .update({ oil_water_last_sent_at: now.toISOString() })
            .eq("id", row.id);
          results.push({ id: row.id, type: "oil_water", status: "sent" });
        } catch (err) {
          console.error("[cron/daily] oil_water send failed", err);
          results.push({ id: row.id, type: "oil_water", status: "failed", reason: (err as Error).message });
        }
      }

      // Test 30 days before
      if (row.remind_test && isDue30DaysBefore(row.test_date, row.test_last_sent_at, now)) {
        const subject = "תזכורת טסט בעוד כחודש";
        const text = `שלום,

הטסט של ${main}${plate ? ` (לוחית ${plate})` : ""} מתקרב (כ-30 יום).
מומלץ לקבוע תור למכון הרישוי ולהתכונן בהתאם.`;
        try {
          await sendEmail(userEmail, subject, text);
          await supabase.from("people_cars").update({ test_last_sent_at: now.toISOString() }).eq("id", row.id);
          results.push({ id: row.id, type: "test", status: "sent" });
        } catch (err) {
          console.error("[cron/daily] test send failed", err);
          results.push({ id: row.id, type: "test", status: "failed", reason: (err as Error).message });
        }
      }

      // Service 30 days before
      if (row.remind_service && isDue30DaysBefore(row.service_date, row.service_last_sent_at, now)) {
        const subject = "תזכורת טיפול רכב בעוד כחודש";
        const text = `שלום,

הטיפול הבא של ${main}${plate ? ` (לוחית ${plate})` : ""} מתקרב (כ-30 יום).
מומלץ לקבוע מועד טיפול ולהכין חלקים/שמנים לפי היצרן.`;
        try {
          await sendEmail(userEmail, subject, text);
          await supabase.from("people_cars").update({ service_last_sent_at: now.toISOString() }).eq("id", row.id);
          results.push({ id: row.id, type: "service", status: "sent" });
        } catch (err) {
          console.error("[cron/daily] service send failed", err);
          results.push({ id: row.id, type: "service", status: "failed", reason: (err as Error).message });
        }
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[cron/daily] fatal error", err);
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}

// Allow Vercel Cron (GET) to hit this route as well
export async function GET(req: Request) {
  return POST(req);
}

