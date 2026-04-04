import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authed = Boolean(secret && cookie && cookie === secret);

  if (authed) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const next = encodeURIComponent(`${pathname}${search}`);
  return NextResponse.redirect(new URL(`/login?next=${next}`, req.url));
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
