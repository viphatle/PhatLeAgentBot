import { isTradingSession, vnTimeLabel } from "@/lib/market";
import { storageReady } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    vn_time: vnTimeLabel(),
    in_session: isTradingSession(),
    storage_ready: storageReady(),
  });
}
