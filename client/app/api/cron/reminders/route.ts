import { NextResponse } from "next/server";

/**
 * Placeholder route for cron reminders.
 * Vercel requires the file to export a handler; this returns 200 OK.
 * Replace with real logic once cron is wired.
 */
export async function GET() {
  return NextResponse.json({ ok: true, message: "cron reminders placeholder" });
}

