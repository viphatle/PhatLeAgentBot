import { getSettings, KvRequiredError, setSettings } from "@/lib/kv";
import { verifySessionToken } from "@/lib/session";
import { authSecret } from "@/lib/auth";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

// Get current user from session
async function getCurrentUserFromRequest(req: Request): Promise<{ uid: string; role: string } | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/st_session=([^;]+)/);
  if (!sessionMatch) return null;
  
  const token = sessionMatch[1];
  const session = await verifySessionToken(token, authSecret());
  if (!session) return null;
  
  return { uid: session.uid, role: session.role };
}

export async function GET(req: Request) {
  const s = await getSettings();
  const currentUser = await getCurrentUserFromRequest(req);
  
  // Filter users based on visibility (admin/manager see all, viewer see only themselves)
  let visibleUsers = s.users || [];
  if (currentUser) {
    const isAdminOrManager = currentUser.role === "admin" || currentUser.role === "super_admin" || currentUser.role === "manager";
    if (!isAdminOrManager) {
      // Viewer can only see themselves
      visibleUsers = visibleUsers.filter((u: User) => u.id === currentUser.uid || u.email === currentUser.uid);
    }
  }
  
  return Response.json({
    telegram_chat_id: s.telegram_chat_id,
    mock_prices: s.mock_prices,
    has_telegram_token: Boolean(s.telegram_bot_token.trim()),
    users: visibleUsers,
    current_user_id: s.current_user_id,
    currentUser: currentUser ? { uid: currentUser.uid, role: currentUser.role } : null,
  });
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return Response.json({ error: "Vui lòng đăng nhập" }, { status: 401 });
    }
    
    // Only admin/manager can modify users
    const canManageUsers = currentUser.role === "admin" || currentUser.role === "super_admin" || currentUser.role === "manager";
    
    const body = (await req.json()) as {
      telegram_bot_token?: string;
      telegram_chat_id?: string;
      mock_prices?: boolean;
      users?: User[];
      current_user_id?: string;
    };
    const patch: Partial<{
      telegram_bot_token: string;
      telegram_chat_id: string;
      mock_prices: boolean;
      users: User[];
      current_user_id: string;
    }> = {};
    
    // Telegram settings - any logged in user can update
    if (typeof body.telegram_chat_id === "string") {
      patch.telegram_chat_id = body.telegram_chat_id.trim();
    }
    if (typeof body.telegram_bot_token === "string" && body.telegram_bot_token.trim()) {
      patch.telegram_bot_token = body.telegram_bot_token.trim();
    }
    if (typeof body.mock_prices === "boolean") {
      patch.mock_prices = body.mock_prices;
    }
    
    // User management - requires admin/manager permission
    if (Array.isArray(body.users)) {
      if (!canManageUsers) {
        return Response.json({ error: "Bạn không có quyền quản lý người dùng" }, { status: 403 });
      }
      
      // SECURITY: Prevent self-role escalation
      const existingSettings = await getSettings();
      const existingUsers = existingSettings.users || [];
      
      // Check if someone is trying to change their own role
      const selfRoleChange = body.users.find((u: User) => 
        u.id === currentUser.uid && 
        existingUsers.find((eu: User) => eu.id === u.id)?.role !== u.role
      );
      
      if (selfRoleChange) {
        return Response.json({ error: "Không thể tự thay đổi vai trò của chính mình" }, { status: 403 });
      }
      
      // Check if viewer is trying to promote themselves or others
      if (currentUser.role === "viewer" || currentUser.role === "user") {
        return Response.json({ error: "Bạn không có quyền thay đổi vai trò" }, { status: 403 });
      }
      
      patch.users = body.users;
    }
    
    // Current user switch - allow if valid
    if (typeof body.current_user_id === "string") {
      patch.current_user_id = body.current_user_id;
    }
    
    await setSettings(patch);
    return GET(req);
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}
