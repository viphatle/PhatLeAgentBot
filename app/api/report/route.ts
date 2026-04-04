import { sendStockDigest } from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * Gửi báo cáo thủ công. Production: đặt ADMIN_SECRET trên Vercel và gửi
 * header Authorization: Bearer <ADMIN_SECRET>
 */
export async function POST(req: Request) {
  const admin = process.env.ADMIN_SECRET?.trim();
  if (admin) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${admin}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  const r = await sendStockDigest({
    force: true,
    sessionLabel: "gửi thử từ web",
  });
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
