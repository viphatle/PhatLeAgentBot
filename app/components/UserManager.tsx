"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, UserRole, Permission, RolePermissions } from "@/lib/types";

type StandardRole = "admin" | "manager" | "viewer";

const roleLabels: Record<StandardRole, { label: string; color: string }> = {
  admin: { label: "Quản trị viên", color: "bg-rose-500" },
  manager: { label: "Quản lý", color: "bg-blue-500" },
  viewer: { label: "Người xem", color: "bg-slate-500" },
};

// Safe accessor for role labels (handles custom role)
const getRoleLabel = (role: UserRole) => {
  if (role === "custom") return { label: "Tùy chỉnh", color: "bg-purple-500" };
  return roleLabels[role];
};

// All available permissions
const ALL_PERMISSIONS: { id: Permission; label: string; icon: string }[] = [
  { id: "view_prices", label: "Xem giá chứng khoán", icon: "📈" },
  { id: "edit_watchlist", label: "Sửa watchlist", icon: "📝" },
  { id: "send_telegram", label: "Gửi Telegram", icon: "📨" },
  { id: "manage_users", label: "Quản lý người dùng", icon: "👥" },
  { id: "system_settings", label: "Cài đặt hệ thống", icon: "⚙️" },
  { id: "view_schedule", label: "Xem lịch biểu", icon: "📅" },
  { id: "edit_schedule", label: "Sửa lịch biểu", icon: "✏️" },
  { id: "view_news", label: "Xem tin tức", icon: "📰" },
  { id: "upload_files", label: "Tải lên tệp tin", icon: "📤" },
  { id: "view_files", label: "Xem tệp tin", icon: "📁" },
];

// Default permissions for each role
const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: ["view_prices", "edit_watchlist", "send_telegram", "manage_users", "system_settings", "view_schedule", "edit_schedule", "view_news", "upload_files", "view_files"],
  manager: ["view_prices", "edit_watchlist", "send_telegram", "view_schedule", "edit_schedule", "view_news", "view_files"],
  viewer: ["view_prices", "view_schedule", "view_news", "view_files"],
};

export function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form states for ADD
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("viewer");
  
  // Form states for EDIT
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  
  // Role permissions customization
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [showPermissionsEditor, setShowPermissionsEditor] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      // Fetch auth user from login system
      const authRes = await fetch("/api/auth/me", { cache: "no-store" });
      let authUser = null;
      if (authRes.ok) {
        const authData = await authRes.json();
        authUser = authData.user;
      }

      const res = await fetch("/api/config/telegram", { cache: "no-store" });
      if (!res.ok) throw new Error("Không thể tải cấu hình");
      const data = await res.json();
      let userList = data.users || [];
      
      // If auth user exists but not in user list, auto-add them
      if (authUser && !userList.find((u: User) => u.id === authUser.id)) {
        const newAuthUser: User = {
          id: authUser.id,
          email: authUser.id,
          name: authUser.id.split('@')[0] || authUser.id,
          role: authUser.role === "super_admin" ? "admin" : (authUser.role as UserRole),
          created_at: new Date().toISOString(),
          is_active: true,
        };
        userList = [newAuthUser, ...userList];
        // Auto-save the new user
        await fetch("/api/config/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ users: userList, current_user_id: authUser.id }),
        });
      }
      
      setUsers(userList);
      
      // Set current user from auth system priority
      if (authUser) {
        const cu = userList.find((u: User) => u.id === authUser.id);
        setCurrentUser(cu || null);
      } else if (data.current_user_id) {
        const cu = userList.find((u: User) => u.id === data.current_user_id);
        setCurrentUser(cu || null);
      }
      
      // Load custom role permissions or use defaults
      if (data.role_permissions) {
        setRolePermissions(data.role_permissions);
      }
      setError(null);
    } catch (err) {
      setError("Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveUsers = async (updatedUsers: User[]) => {
    try {
      setSaving(true);
      const res = await fetch("/api/config/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: updatedUsers }),
      });
      if (!res.ok) throw new Error("Lưu thất bại");
      setUsers(updatedUsers);
      setSuccess("Đã lưu thay đổi");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Không thể lưu thay đổi");
    } finally {
      setSaving(false);
    }
  };

  const saveRolePermissions = async (updatedPermissions: RolePermissions) => {
    try {
      setSaving(true);
      const res = await fetch("/api/config/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_permissions: updatedPermissions }),
      });
      if (!res.ok) throw new Error("Lưu thất bại");
      setRolePermissions(updatedPermissions);
      setSuccess("Đã cập nhật quyền cho các vai trò");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Không thể lưu cấu hình quyền");
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (role: keyof RolePermissions, permission: Permission) => {
    const currentPerms = rolePermissions[role];
    const hasPermission = currentPerms.includes(permission);
    
    const newPerms = hasPermission
      ? currentPerms.filter(p => p !== permission)
      : [...currentPerms, permission];
    
    const updated: RolePermissions = {
      ...rolePermissions,
      [role]: newPerms,
    };
    
    setRolePermissions(updated);
    saveRolePermissions(updated);
  };

  const addUser = async () => {
    if (!newUserEmail || !newUserName) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    if (users.some(u => u.email === newUserEmail)) {
      setError("Email này đã tồn tại");
      return;
    }

    // First user automatically becomes admin
    const isFirstUser = users.length === 0;
    const assignedRole = isFirstUser ? "admin" : newUserRole;
    
    const newUser: User = {
      id: `user_${Date.now()}`,
      email: newUserEmail,
      name: newUserName,
      role: assignedRole,
      created_at: new Date().toISOString(),
      is_active: true,
    };

    const updatedUsers = [...users, newUser];
    await saveUsers(updatedUsers);
    
    // If first user, auto-set as current user
    if (isFirstUser) {
      await fetch("/api/config/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_user_id: newUser.id }),
      });
      setCurrentUser(newUser);
      setSuccess(`Người dùng đầu tiên "${newUser.name}" đã được tạo với quyền Admin`);
    }
    
    // Reset form
    setNewUserEmail("");
    setNewUserName("");
    setNewUserRole("viewer");
    setShowAddForm(false);
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa người dùng này?")) return;
    
    const updatedUsers = users.filter(u => u.id !== id);
    await saveUsers(updatedUsers);
  };

  const toggleUserStatus = async (id: string) => {
    const updatedUsers = users.map(u => 
      u.id === id ? { ...u, is_active: !u.is_active } : u
    );
    await saveUsers(updatedUsers);
  };

  const changeUserRole = async (id: string, newRole: UserRole) => {
    console.log(`[UserManager] Changing role for ${id} to ${newRole}`);
    const userToUpdate = users.find(u => u.id === id);
    if (!userToUpdate) {
      setError("Không tìm thấy người dùng");
      return;
    }
    
    const updatedUsers = users.map(u => 
      u.id === id ? { ...u, role: newRole } : u
    );
    
    console.log(`[UserManager] Updated users:`, updatedUsers);
    await saveUsers(updatedUsers);
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditName("");
    setEditEmail("");
  };

  const saveEditUser = async () => {
    if (!editingUser) return;
    if (!editName || !editEmail) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    // Check email duplicate (excluding current user)
    if (users.some(u => u.email === editEmail && u.id !== editingUser.id)) {
      setError("Email này đã được sử dụng bởi người dùng khác");
      return;
    }

    const updatedUsers = users.map(u => 
      u.id === editingUser.id 
        ? { ...u, name: editName, email: editEmail } 
        : u
    );
    await saveUsers(updatedUsers);
    cancelEdit();
  };

  const switchToUser = async (id: string) => {
    try {
      const res = await fetch("/api/config/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_user_id: id }),
      });
      if (!res.ok) throw new Error("Chuyển đổi thất bại");
      
      const user = users.find(u => u.id === id);
      setCurrentUser(user || null);
      setSuccess(`Đã chuyển sang: ${user?.name}`);
      setTimeout(() => setSuccess(null), 3000);
      window.location.reload();
    } catch (err) {
      setError("Không thể chuyển đổi người dùng");
    }
  };

  // Can manage if: has admin/manager role, or no users yet (initial setup)
  const canManageUsers = !currentUser || currentUser?.role === "admin" || currentUser?.role === "manager";
  const isAdmin = currentUser?.role === "admin" || !currentUser; // First user becomes admin

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            👥 Quản lý người dùng
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Phân quyền và quản lý truy cập hệ thống
          </p>
        </div>
        {currentUser && (
          <div className="text-right">
            <p className="text-sm font-medium text-slate-200">{currentUser.name}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs text-white ${getRoleLabel(currentUser.role).color}`}>
              {getRoleLabel(currentUser.role).label}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-900/30 border border-rose-800 rounded-lg text-rose-300 text-sm">
          ⚠️ {error}
          <button onClick={() => setError(null)} className="ml-2 text-rose-400 hover:text-rose-200">✕</button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-800 rounded-lg text-emerald-300 text-sm">
          ✅ {success}
        </div>
      )}

      {/* Debug Info - Shows linked auth user */}
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">👤 Tài khoản đăng nhập (Auth):</span>
          {currentUser ? (
            <span className="text-sm text-emerald-400">
              {currentUser.name} ({currentUser.email}) - {getRoleLabel(currentUser.role).label}
            </span>
          ) : (
            <span className="text-sm text-rose-400">⚠️ Chưa đăng nhập</span>
          )}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          ID: {currentUser?.id || "N/A"} | Quyền quản lý: {canManageUsers ? "Có" : "Không"} | Admin: {isAdmin ? "Có" : "Không"}
        </div>
        {currentUser && (
          <div className="mt-1 text-xs text-emerald-500/70">
            ✅ Đã liên kết với hệ thống đăng nhập
          </div>
        )}
      </div>

      {/* Role Info with Permission Editor */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">Các vai trò và quyền hạn</span>
        {isAdmin && (
          <button
            onClick={() => setShowPermissionsEditor(!showPermissionsEditor)}
            className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            {showPermissionsEditor ? "✕ Đóng chỉnh sửa" : "⚙️ Tùy chỉnh quyền"}
          </button>
        )}
      </div>

      {/* Permissions Editor */}
      {showPermissionsEditor && isAdmin && (
        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h3 className="font-medium text-slate-200 mb-3">⚙️ Tùy chỉnh quyền cho từng vai trò</h3>
          <div className="space-y-4">
            {(Object.keys(rolePermissions) as Array<keyof RolePermissions>).map((role) => (
              <div key={role} className="border border-slate-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-3 h-3 rounded-full ${roleLabels[role].color}`}></span>
                  <span className="font-medium text-slate-200">{roleLabels[role].label}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {ALL_PERMISSIONS.map((perm) => {
                    const hasPerm = rolePermissions[role].includes(perm.id);
                    return (
                      <button
                        key={perm.id}
                        onClick={() => togglePermission(role, perm.id)}
                        disabled={saving}
                        className={`p-2 rounded text-xs text-left transition-colors ${
                          hasPerm
                            ? "bg-emerald-900/30 border border-emerald-700 text-emerald-300"
                            : "bg-slate-900 border border-slate-700 text-slate-500"
                        }`}
                      >
                        <span className="mr-1">{hasPerm ? "☑️" : "⬜"}</span>
                        <span>{perm.icon}</span>
                        <span className="ml-1">{perm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            💡 Click vào từng quyền để bật/tắt. Thay đổi sẽ áp dụng ngay lập tức.
          </p>
        </div>
      )}

      {/* Simple Role Info (when not editing) */}
      {!showPermissionsEditor && (
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          {(Object.keys(rolePermissions) as Array<keyof RolePermissions>).map((role) => (
            <div key={role} className="p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${roleLabels[role].color}`}></span>
                <span className="font-medium text-slate-200 text-sm">{roleLabels[role].label}</span>
                <span className="text-xs text-slate-500">({rolePermissions[role].length} quyền)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {rolePermissions[role].slice(0, 4).map((permId, i) => {
                  const perm = ALL_PERMISSIONS.find(p => p.id === permId);
                  return (
                    <span key={i} className="text-xs px-2 py-1 bg-slate-900 rounded text-slate-400">
                      {perm?.icon} {perm?.label.split(" ")[0]}
                    </span>
                  );
                })}
                {rolePermissions[role].length > 4 && (
                  <span className="text-xs px-2 py-1 bg-slate-900 rounded text-slate-500">
                    +{rolePermissions[role].length - 4}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Button */}
      {canManageUsers && (
        <div className="mb-4">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showAddForm ? "✕ Hủy" : "➕ Thêm người dùng"}
          </button>
        </div>
      )}

      {/* Add User Form */}
      {showAddForm && canManageUsers && (
        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h3 className="font-medium text-slate-200 mb-3">
            {users.length === 0 ? "🌟 Tạo người dùng đầu tiên (Admin tự động)" : "Thêm người dùng mới"}
          </h3>
          <div className="grid md:grid-cols-4 gap-3">
            <input
              type="email"
              placeholder="Email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Họ tên"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
            />
            {users.length === 0 ? (
              <div className="px-3 py-2 bg-rose-900/30 border border-rose-800 rounded-lg text-rose-300 text-sm flex items-center">
                🔴 Quản trị viên (Auto)
              </div>
            ) : (
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="viewer">Người xem</option>
                <option value="manager">Quản lý</option>
                {isAdmin && <option value="admin">Quản trị viên</option>}
              </select>
            )}
            <button
              onClick={addUser}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "⏳" : "💾 Lưu"}
            </button>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-center text-slate-500 py-8">Đang tải...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Chưa có người dùng nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="pb-2 font-medium">Người dùng</th>
                  <th className="pb-2 font-medium">Vai trò</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                  <th className="pb-2 font-medium">Ngày tạo</th>
                  <th className="pb-2 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    {editingUser?.id === user.id ? (
                      // EDIT MODE
                      <>
                        <td className="py-3" colSpan={2}>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Họ tên"
                              className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                            />
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="Email"
                              className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </td>
                        <td className="py-3"></td>
                        <td className="py-3"></td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={saveEditUser}
                              disabled={saving}
                              className="px-2 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                            >
                              {saving ? "⏳" : "💾 Lưu"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                            >
                              ✕ Hủy
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // VIEW MODE
                      <>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-200">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          {/* Role dropdown - disabled for self, enabled for others */}
                          {canManageUsers && user.id !== currentUser?.id ? (
                            <div className="relative">
                              <select
                                value={user.role}
                                onChange={(e) => {
                                  const newRole = e.target.value as UserRole;
                                  console.log(`[UserManager] Selected: ${newRole}`);
                                  changeUserRole(user.id, newRole);
                                }}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                style={{ minWidth: '140px' }}
                              >
                                <option value="viewer">👤 Người xem</option>
                                <option value="manager">🔷 Quản lý</option>
                                <option value="admin">🔴 Quản trị viên</option>
                              </select>
                            </div>
                          ) : (
                            <span className={`inline-flex items-center px-3 py-2 rounded-lg text-sm text-white ${getRoleLabel(user.role).color}`}>
                              {getRoleLabel(user.role).label}
                              {user.id === currentUser?.id && (
                                <span className="ml-2 text-xs opacity-70">(không thể tự đổi)</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => toggleUserStatus(user.id)}
// ...
                            className={`inline-flex items-center px-2 py-1 rounded text-xs transition-colors ${
                              user.is_active
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-slate-700 text-slate-500"
                            }`}
                          >
                            {user.is_active ? "🟢 Hoạt động" : "⚪ Vô hiệu"}
                          </button>
                        </td>
                        <td className="py-3 text-slate-500 text-xs">
                          {new Date(user.created_at).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => switchToUser(user.id)}
                              disabled={user.id === currentUser?.id}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                user.id === currentUser?.id
                                  ? "bg-emerald-600 text-white cursor-default"
                                  : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                              }`}
                            >
                              {user.id === currentUser?.id ? "✓ Đang dùng" : "↔️ Chuyển"}
                            </button>
                            {canManageUsers && (
                              <button
                                onClick={() => startEditUser(user)}
                                className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium flex items-center gap-1"
                                title="Sửa thông tin"
                              >
                                ✏️ Sửa
                              </button>
                            )}
                            {/* Delete button for OTHER users */}
                            {canManageUsers && user.id !== currentUser?.id && (
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="px-3 py-1.5 rounded-lg text-xs bg-rose-600 hover:bg-rose-500 text-white transition-colors font-medium flex items-center gap-1"
                                title="Xóa người dùng này"
                              >
                                🗑️ Xóa
                              </button>
                            )}
                            {/* Delete button for CURRENT user (any manager/admin can delete themselves) */}
                            {canManageUsers && user.id === currentUser?.id && users.length > 1 && (
                              <button
                                onClick={() => {
                                  if (confirm("⚠️ Bạn đang xóa TÀI KHOẢN HIỆN TẠI của mình!\n\nSau khi xóa, bạn sẽ bị đăng xuất.\n\nBạn có chắc chắn muốn xóa?")) {
                                    deleteUser(user.id);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs bg-rose-700 hover:bg-rose-600 text-white transition-colors font-medium flex items-center gap-1 border border-rose-400"
                                title="Xóa tài khoản hiện tại (sẽ bị đăng xuất)"
                              >
                                🗑️ Xóa (tài khoản này)
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
