import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CarRow = {
  id: string;
  user_id: string;
  license_plate: string | null;
  remind_tires: boolean | null;
  tires_started_at: string | null;
  tires_last_sent_at: string | null;
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

function isDueEveryNDays(startedAt: string | null, lastSentAt: string | null, intervalDays: number, now: Date) {
  if (!startedAt) return false;
  const baseline = lastSentAt ? new Date(lastSentAt) : new Date(startedAt);
  return daysBetween(baseline, now) >= intervalDays - 0.01;
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
          remind_tires,
          tires_started_at,
          tires_last_sent_at,
          users ( email ),
          vehicle_catalog:vehicle_catalog_id ( manufacturer, model, year )
        `
      )
      .eq("remind_tires", true);

    if (error) {
      console.error("[cron/tires] supabase error", error);
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
        results.push({ id: row.id, type: "tires", status: "skipped", reason: "no_email" });
        continue;
      }

      if (!isDueEveryNDays(row.tires_started_at, row.tires_last_sent_at, 14, now)) {
        results.push({ id: row.id, type: "tires", status: "skipped", reason: "not_due" });
        continue;
      }

      const { main, plate } = formatCar(row);
      const subject = "תזכורת בדיקת לחץ אוויר בצמיגים";
      const text = `שלום,

זה תזכורת לבדוק לחץ אוויר בצמיגים עבור ${main}${plate ? ` (לוחית ${plate})` : ""}.

מומלץ לבדוק ולהתאים לפי ספר הרכב.`;

      try {
        await sendEmail(userEmail, subject, text);
        await sleep(SEND_DELAY_MS);
        await supabase.from("people_cars").update({ tires_last_sent_at: now.toISOString() }).eq("id", row.id);
        results.push({ id: row.id, type: "tires", status: "sent" });
      } catch (err) {
        console.error("[cron/tires] send failed", err);
        results.push({ id: row.id, type: "tires", status: "failed", reason: (err as Error).message });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[cron/tires] fatal error", err);
    return NextResponse.json({ error: "internal_error", message: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}

