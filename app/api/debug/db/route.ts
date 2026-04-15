import { storageReady, SupabaseRequiredError } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

function getClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new SupabaseRequiredError();
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

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
