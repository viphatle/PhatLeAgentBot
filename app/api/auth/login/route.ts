import { AUTH_COOKIE_NAME, authConfigured, isValidLogin, sessionValue } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authConfigured()) {
    return Response.json(
      { error: "Thiếu AUTH_USERNAME/AUTH_PASSWORD/AUTH_SECRET trong môi trường." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  if (!isValidLogin(username, password)) {
    return Response.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${AUTH_COOKIE_NAME}=${sessionValue()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return res;
}
