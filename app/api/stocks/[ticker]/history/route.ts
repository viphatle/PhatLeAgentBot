import { fetchHistoryWithStats, type HistoryPeriod } from "@/lib/history";
import { fetchQuote } from "@/lib/prices";
import { getForecast, setForecast } from "@/lib/kv";

export const dynamic = "force-dynamic";

function parsePeriod(v: string | null): HistoryPeriod {
  if (v === "week" || v === "month" || v === "quarter" || v === "half" || v === "year") return v;
  return "month";
}

export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker?.toUpperCase().trim();
  if (!ticker) {
    return Response.json({ error: "Thiếu mã cổ phiếu." }, { status: 400 });
  }
  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period"));
  
  // Get real-time price for anchor
  let currentPrice: number | null = null;
  try {
    const quote = await fetchQuote(ticker, { mock: false });
    if (quote && quote.price > 0) {
      currentPrice = quote.price;
    }
  } catch {
    // Fallback to using last close if quote fails
    currentPrice = null;
  }
  
  // Get previous forecast for continuity
  let previousForecast = null;
  try {
    previousForecast = await getForecast(ticker, period);
  } catch {
    previousForecast = null;
  }
  
  const data = await fetchHistoryWithStats(ticker, period, currentPrice, previousForecast);
  if (!data) {
    return Response.json({ error: "Không lấy được dữ liệu lịch sử cho mã này." }, { status: 503 });
  }
  
  // Store forecast for next continuity
  try {
    await setForecast(ticker, period, data.forecast);
  } catch {
    // Non-critical: continue even if storage fails
  }
  
  return Response.json(data);
}
