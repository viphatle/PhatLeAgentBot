import { getClient, storageReady } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!storageReady()) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = getClient();
  
  // Test watchlist table
  const { data: watchlistData, error: watchlistError } = await supabase
    .from("watchlist")
    .select("count", { count: "exact", head: true });
  
  // Test forecast_history table  
  const { data: historyData, error: historyError } = await supabase
    .from("forecast_history")
    .select("count", { count: "exact", head: true });

  return Response.json({
    supabase_configured: true,
    tables: {
      watchlist: {
        exists: !watchlistError || watchlistError.code !== "42P01",
        error: watchlistError ? {
          code: watchlistError.code,
          message: watchlistError.message,
        } : null,
      },
      forecast_history: {
        exists: !historyError || historyError.code !== "42P01", 
        error: historyError ? {
          code: historyError.code,
          message: historyError.message,
        } : null,
      },
    },
  });
}
