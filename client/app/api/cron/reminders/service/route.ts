import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CarRow = {
  id: string;
  user_id: string;
  license_plate: string | null;
  service_date: string | null;
  service_last_sent_at: string | null;
  users: { email: string | null } | null;
  vehicle_catalog: { manufacturer: string | null; model: string | null; year: number | null } | null;
};

const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SEND_DELAY_MS = Number(process.env.REMINDER_SEND_DELAY_MS ?? "1200");

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Missing Supabase env vars (URL or SERVICE_ROLE_KEY)");
  return createClient(url, serviceRoleKey);
}

function isAuthorized(req: Request) {
  if (!CRON_SECRET) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token && token === CRON_SECRET;
}

function daysBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

function dueInWindow30(targetDate: string | null, lastSentAt: string | null, now: Date): { due: boolean; days: number } {
  if (!targetDate) return { due: false, days: Number.POSITIVE_INFINITY };
  const target = new Date(targetDate + "T00:00:00Z");
  const daysToTarget = Math.floor(daysBetween(now, target));
  if (daysToTarget < 0 || daysToTarget > 30) return { due: false, days: daysToTarget };
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
    body: JSON.stringify({ from, to, subject, text }),
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
    if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const supabase = getSupabase();
    const now = new Date();

    const { data, error } = await supabase
      .from("people_cars")
      .select(
        `
          id,
          user_id,
          license_plate,
          service_date,
          service_last_sent_at,
          users ( email ),
          vehicle_catalog:vehicle_catalog_id ( manufacturer, model, year )
        `
      );

    if (error) {
      console.error("[cron/service] supabase error", error);
      return NextResponse.json({ error: "db_error", details: error.message }, { status: 500 });
    }

    const rawRows = (data || []) as any[];
    const rows: CarRow[] = rawRows.map((r) => ({
      ...r,
      users: Array.isArray(r.users) ? r.users[0] ?? { email: null } : r.users ?? { email: null },
      vehicle_catalog: Array.isArray(r.vehicle_catalog)
        ? r.vehicle_catalog[0] ?? { manufacturer: null, model: null, year: null }
        : r.vehicle_catalog ?? { manufacturer: null, model: null, year: null },
    }));

    const results: { id: string; type: string; status: "sent" | "skipped" | "failed"; reason?: string }[] = [];

    for (const row of rows) {
      const userEmail = row.users?.email?.trim();
      if (!userEmail) {
        results.push({ id: row.id, type: "service", status: "skipped", reason: "no_email" });
        continue;
      }

      const window = dueInWindow30(row.service_date, row.service_last_sent_at, now);
      if (!row.service_date) {
        results.push({ id: row.id, type: "service", status: "skipped", reason: "no_service_date" });
        continue;
      }
      if (!window.due) {
        results.push({
          id: row.id,
          type: "service",
          status: "skipped",
          reason: window.days > 30 ? "not_in_window" : "already_sent_recently_or_not_due",
        });
        continue;
      }

      const { main, plate } = formatCar(row);
      const label = formatDaysLabel(window.days);
      const subject = `תזכורת טיפול רכב ${label}`;
      const text = `שלום,

הטיפול הבא של ${main}${plate ? ` (לוחית ${plate})` : ""} מתקרב (${label}).
מומלץ לקבוע מועד טיפול ולהכין חלקים/שמנים לפי היצרן.`;

      try {
        await sendEmail(userEmail, subject, text);
        await sleep(SEND_DELAY_MS);
        await supabase.from("people_cars").update({ service_last_sent_at: now.toISOString() }).eq("id", row.id);
        results.push({ id: row.id, type: "service", status: "sent" });
      } catch (err) {
        console.error("[cron/service] send failed", err);
        results.push({ id: row.id, type: "service", status: "failed", reason: (err as Error).message });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[cron/service] fatal error", err);
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}

