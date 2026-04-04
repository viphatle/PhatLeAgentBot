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
    return Response.json(q);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi";
    return Response.json({ error: msg }, { status: 400 });
  }
}
