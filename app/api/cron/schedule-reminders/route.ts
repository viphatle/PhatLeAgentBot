import { processScheduleReminders } from "@/lib/schedule-reminders";

export const dynamic = "force-dynamic";

/** Vercel Cron: GET + Authorization: Bearer CRON_SECRET */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const r = await processScheduleReminders();
  return Response.json(r);
}
