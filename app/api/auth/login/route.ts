import { authenticateUser, authConfigured, createSessionForUser, ensureBootstrapAdmin } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authConfigured()) {
    return Response.json(
      { error: "Thiếu AUTH_SECRET hoặc REDIS_URL trong môi trường." },
      { status: 500 },
    );
  }

  await ensureBootstrapAdmin();

  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  const user = await authenticateUser(username, password);
  if (!user) {
    return Response.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }

  const sessionToken = await createSessionForUser(user);
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${AUTH_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return res;
}
