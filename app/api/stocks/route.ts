import { getWatchlist, KvRequiredError, setWatchlist } from "@/lib/kv";
import type { WatchItem } from "@/lib/types";
import { resolveYahooInstrument } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getWatchlist();
  return Response.json(items);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { symbol?: string; buy_price?: number | string };
    const symbol = body.symbol?.trim().toUpperCase() ?? "";
    if (!symbol || symbol.length > 20) {
      return Response.json({ error: "Mã không hợp lệ" }, { status: 400 });
    }
    const rawBuyPrice = body.buy_price;
    const buyPrice =
      rawBuyPrice === undefined || rawBuyPrice === null || rawBuyPrice === ""
        ? undefined
        : Number(rawBuyPrice);
    if (buyPrice !== undefined && (!Number.isFinite(buyPrice) || buyPrice <= 0)) {
      return Response.json({ error: "Giá mua không hợp lệ" }, { status: 400 });
    }
    const list = await getWatchlist();
    if (list.some((x) => x.symbol === symbol)) {
      return Response.json({ error: "Mã đã có trong danh sách" }, { status: 400 });
    }
    const info = await resolveYahooInstrument(symbol);
    if (!info) {
      return Response.json(
        {
          error:
            "Không tìm thấy mã trên Yahoo (.VN / .HNO). Kiểm tra mã HOSE/HNX (ví dụ VCB, FPT, VHM).",
        },
        { status: 404 }
      );
    }
    const item: WatchItem = {
      id: crypto.randomUUID(),
      symbol,
      buy_price: buyPrice,
      display_name: info.display_name,
      short_name: info.short_name,
      exchange: info.exchange,
      full_exchange: info.full_exchange,
      yahoo_symbol: info.yahoo_symbol,
      created_at: new Date().toISOString(),
    };
    await setWatchlist([...list, item]);
    return Response.json(item);
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return Response.json({ error: "Thiếu id" }, { status: 400 });
    }
    const list = await getWatchlist();
    const next = list.filter((x) => x.id !== id);
    if (next.length === list.length) {
      return Response.json({ error: "Không tìm thấy" }, { status: 404 });
    }
    await setWatchlist(next);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}
