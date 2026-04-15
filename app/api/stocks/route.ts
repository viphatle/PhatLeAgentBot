import { getWatchlist, SupabaseRequiredError, setWatchlist } from "@/lib/kv";
import { lookupCompanyNameVi } from "@/lib/company-vi";
import type { WatchItem } from "@/lib/types";
import { resolveYahooInstrument } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

function parseBuyPriceInput(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  const normalized = value.trim().replace(/[_\s,]/g, "");
  return Number(normalized);
}

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
    const buyPrice = parseBuyPriceInput(body.buy_price);
    if (buyPrice !== undefined && (!Number.isFinite(buyPrice) || buyPrice <= 0)) {
      return Response.json({ error: "Giá mua không hợp lệ" }, { status: 400 });
    }
    const list = await getWatchlist();
    if (list.some((x) => x.symbol === symbol)) {
      return Response.json({ error: "Mã đã có trong danh sách" }, { status: 400 });
    }
    const info = await resolveYahooInstrument(symbol);
    const viName = lookupCompanyNameVi(symbol);
    const item: WatchItem = {
      id: crypto.randomUUID(),
      symbol,
      buy_price: buyPrice,
      display_name: info?.display_name || viName || symbol,
      display_name_vi: viName,
      short_name: info?.short_name,
      exchange: info?.exchange || "UPCOM",
      full_exchange: info?.full_exchange,
      yahoo_symbol: info?.yahoo_symbol,
      created_at: new Date().toISOString(),
    };
    await setWatchlist([...list, item]);
    return Response.json(item);
  } catch (e: unknown) {
    if (e instanceof SupabaseRequiredError) {
      return Response.json({ error: (e as Error).message }, { status: 503 });
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
  } catch (e: unknown) {
    if (e instanceof SupabaseRequiredError) {
      return Response.json({ error: (e as Error).message }, { status: 503 });
    }
    throw e;
  }
}
