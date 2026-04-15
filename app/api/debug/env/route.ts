export const dynamic = "force-dynamic";

export async function GET() {
  // Check environment variables (safely - don't expose actual values)
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: {
      set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      value: process.env.NEXT_PUBLIC_SUPABASE_URL 
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 20)}...` 
        : null,
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    },
    AUTH_SECRET: {
      set: Boolean(process.env.AUTH_SECRET),
      length: process.env.AUTH_SECRET?.length ?? 0,
    },
  };

  const allSupabaseVarsSet = checks.NEXT_PUBLIC_SUPABASE_URL.set && checks.SUPABASE_SERVICE_ROLE_KEY.set;

  return Response.json({
    timestamp: new Date().toISOString(),
    environment_checks: checks,
    all_supabase_ready: allSupabaseVarsSet,
    node_env: process.env.NODE_ENV,
  });
}
