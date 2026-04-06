import { maybeSendPnlSpikeAlert } from "@/lib/alerts";
import { getSettings } from "@/lib/kv";
import { fetchQuote } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker;
  try {
    const settings = await getSettings();
    const q = await fetchQuote(ticker, { mock: settings.mock_prices });
    if (!q) {
      return Response.json(
        { error: "Không lấy được giá thị trường gần nhất cho mã này." },
        { status: 503 },
      );
    }
    void maybeSendPnlSpikeAlert(ticker, q).catch(() => {});
    return Response.json(q, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi";
    return Response.json({ error: msg }, { status: 400 });
  }
}
