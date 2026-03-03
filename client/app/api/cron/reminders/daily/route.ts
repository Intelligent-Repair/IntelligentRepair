import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CarRow = {
  id: string;
  user_id: string;
  license_plate: string | null;
  remind_tires: boolean | null;
  remind_oil_water: boolean | null;
  // flags לא נדרשים לטסט/טיפול — משתמשים רק בתאריכים
  remind_test?: boolean | null;
  remind_service?: boolean | null;
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
  } | null;
  vehicle_catalog: {
    manufacturer: string | null;
    model: string | null;
    year: number | null;
  } | null;
};

const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SEND_DELAY_MS = Number(process.env.REMINDER_SEND_DELAY_MS ?? "1200"); // האטה בין שליחות כדי להימנע מ-429

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

function dueInWindow30(
  targetDate: string | null,
  lastSentAt: string | null,
  now: Date
): { due: boolean; days: number } {
  if (!targetDate) return { due: false, days: Number.POSITIVE_INFINITY };
  const target = new Date(targetDate + "T00:00:00Z");
  const daysToTarget = Math.floor(daysBetween(now, target));
  if (daysToTarget < 0) return { due: false, days: daysToTarget }; // עבר
  if (daysToTarget > 30) return { due: false, days: daysToTarget };
  if (!lastSentAt) return { due: true, days: daysToTarget };
  const last = new Date(lastSentAt);
  const daysSinceLast = daysBetween(last, now);
  return { due: daysSinceLast >= 25, days: daysToTarget };
}

function formatDaysLabel(days: number) {
  if (days <= 0) return "היום";
  if (days === 1) return "מחר";
  return `בעוד כ-${days} ימים`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const from = process.env.RESEND_FROM || "onboarding@resend.dev";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
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
          tires_started_at,
          tires_last_sent_at,
          oil_water_started_at,
          oil_water_last_sent_at,
          test_date,
          test_last_sent_at,
          service_date,
          service_last_sent_at,
          users ( email ),
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
        ? r.users[0] ?? { email: null }
        : (r.users ?? { email: null }),
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
          await sleep(SEND_DELAY_MS); // להימנע מ-429 ברצף שליחות
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
          await sleep(SEND_DELAY_MS); // להימנע מ-429 ברצף שליחות
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
      const testWindow = dueInWindow30(row.test_date, row.test_last_sent_at, now);
      if (!row.test_date) {
        results.push({ id: row.id, type: "test", status: "skipped", reason: "no_test_date" });
      } else if (testWindow.due) {
        const label = formatDaysLabel(testWindow.days);
        const subject = `תזכורת טסט ${label}`;
        const text = `שלום,

הטסט של ${main}${plate ? ` (לוחית ${plate})` : ""} מתקרב (${label}).
מומלץ לקבוע תור למכון הרישוי ולהתכונן בהתאם.`;
        try {
          await sendEmail(userEmail, subject, text);
          await sleep(SEND_DELAY_MS); // להימנע מ-429 ברצף שליחות
          await supabase.from("people_cars").update({ test_last_sent_at: now.toISOString() }).eq("id", row.id);
          results.push({ id: row.id, type: "test", status: "sent" });
        } catch (err) {
          console.error("[cron/daily] test send failed", err);
          results.push({ id: row.id, type: "test", status: "failed", reason: (err as Error).message });
        }
      } else {
        results.push({
          id: row.id,
          type: "test",
          status: "skipped",
          reason: testWindow.days > 30 ? "not_in_window" : "already_sent_recently_or_not_due",
        });
      }

      // Service 30 days before
      const serviceWindow = dueInWindow30(row.service_date, row.service_last_sent_at, now);
      if (!row.service_date) {
        results.push({ id: row.id, type: "service", status: "skipped", reason: "no_service_date" });
      } else if (serviceWindow.due) {
        const label = formatDaysLabel(serviceWindow.days);
        const subject = `תזכורת טיפול רכב ${label}`;
        const text = `שלום,

הטיפול הבא של ${main}${plate ? ` (לוחית ${plate})` : ""} מתקרב (${label}).
מומלץ לקבוע מועד טיפול ולהכין חלקים/שמנים לפי היצרן.`;
        try {
          await sendEmail(userEmail, subject, text);
          await sleep(SEND_DELAY_MS); // להימנע מ-429 ברצף שליחות
          await supabase.from("people_cars").update({ service_last_sent_at: now.toISOString() }).eq("id", row.id);
          results.push({ id: row.id, type: "service", status: "sent" });
        } catch (err) {
          console.error("[cron/daily] service send failed", err);
          results.push({ id: row.id, type: "service", status: "failed", reason: (err as Error).message });
        }
      } else {
        results.push({
          id: row.id,
          type: "service",
          status: "skipped",
          reason: serviceWindow.days > 30 ? "not_in_window" : "already_sent_recently_or_not_due",
        });
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

