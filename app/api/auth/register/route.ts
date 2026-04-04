import {
  authConfigured,
  createSessionForUser,
  createUser,
  ensureBootstrapAdmin,
  getUsers,
  verifySessionFromCookie,
} from "@/lib/auth";
import { AUTH_COOKIE_NAME, type SessionRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RegisterBody = {
  id?: string;
  password?: string;
  role?: SessionRole;
};

export async function POST(req: Request) {
  if (!authConfigured()) {
    return Response.json(
      { error: "Thiếu AUTH_SECRET hoặc REDIS_URL trong môi trường." },
      { status: 500 },
    );
  }

  await ensureBootstrapAdmin();

  const body = (await req.json().catch(() => ({}))) as RegisterBody;
  const id = body.id?.trim() ?? "";
  const password = body.password ?? "";
  const requestedRole: SessionRole = body.role === "admin" || body.role === "super_admin" ? body.role : "user";

  const cookieHeader = req.headers.get("cookie") ?? "";
  const currentToken = cookieHeader
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);
  const currentSession = await verifySessionFromCookie(currentToken);

  const users = await getUsers();
  const firstAccount = users.length === 0;
  const allowOpenBootstrap = firstAccount && requestedRole === "super_admin";
  const allowBySession = currentSession?.role === "super_admin";

  if (!allowOpenBootstrap && !allowBySession) {
    return Response.json({ error: "Chỉ super admin mới có quyền tạo tài khoản." }, { status: 403 });
  }

  try {
    const created = await createUser({
      id,
      password,
      role: allowBySession ? requestedRole : "super_admin",
    });

    // Nếu đang bootstrap lần đầu, đăng nhập luôn tài khoản vừa tạo.
    const res = Response.json({
      ok: true,
      user: { id: created.id, role: created.role },
    });
    if (allowOpenBootstrap) {
      const token = await createSessionForUser(created);
      res.headers.append(
        "Set-Cookie",
        `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      );
    }
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tạo được tài khoản.";
    return Response.json({ error: message }, { status: 400 });
  }
}
