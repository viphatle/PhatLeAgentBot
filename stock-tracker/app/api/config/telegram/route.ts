import { getSettings, KvRequiredError, setSettings } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return Response.json({
    telegram_chat_id: s.telegram_chat_id,
    mock_prices: s.mock_prices,
    has_telegram_token: Boolean(s.telegram_bot_token.trim()),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      telegram_bot_token?: string;
      telegram_chat_id?: string;
      mock_prices?: boolean;
    };
    const patch: Partial<{
      telegram_bot_token: string;
      telegram_chat_id: string;
      mock_prices: boolean;
    }> = {};
    if (typeof body.telegram_chat_id === "string") {
      patch.telegram_chat_id = body.telegram_chat_id.trim();
    }
    if (typeof body.telegram_bot_token === "string" && body.telegram_bot_token.trim()) {
      patch.telegram_bot_token = body.telegram_bot_token.trim();
    }
    if (typeof body.mock_prices === "boolean") {
      patch.mock_prices = body.mock_prices;
    }
    await setSettings(patch);
    return GET();
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}
