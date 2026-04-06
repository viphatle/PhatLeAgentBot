import { fetchHistoryWithStats, type HistoryPeriod } from "@/lib/history";

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
  const data = await fetchHistoryWithStats(ticker, period);
  if (!data) {
    return Response.json({ error: "Không lấy được dữ liệu lịch sử cho mã này." }, { status: 503 });
  }
  return Response.json(data);
}
