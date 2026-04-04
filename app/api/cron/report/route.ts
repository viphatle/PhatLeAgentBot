import { sendStockDigest } from "@/lib/report";

export const dynamic = "force-dynamic";

/** Vercel Cron: GET + Authorization: Bearer CRON_SECRET */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const r = await sendStockDigest({
    force: false,
    sessionLabel: "tự động (Vercel Cron)",
  });
  if (!r.ok && r.reason === "outside_session") {
    return Response.json({ ok: true, skipped: true, reason: r.reason });
  }
  return Response.json(r);
}
