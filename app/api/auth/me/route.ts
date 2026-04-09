import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";
import { authSecret } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// GET - Get current authenticated user
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("st_session")?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Chưa đăng nhập", user: null },
        { status: 401 }
      );
    }

    const session = await verifySessionToken(sessionCookie, authSecret());
    
    if (!session) {
      return NextResponse.json(
        { error: "Phiên đăng nhập hết hạn", user: null },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: session.uid,
        role: session.role,
      }
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json(
      { error: "Không thể xác thực", user: null },
      { status: 500 }
    );
  }
}
