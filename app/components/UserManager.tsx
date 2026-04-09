"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, UserRole } from "@/lib/types";

const roleLabels: Record<UserRole, { label: string; color: string }> = {
  admin: { label: "Quản trị viên", color: "bg-rose-500" },
  manager: { label: "Quản lý", color: "bg-blue-500" },
  viewer: { label: "Người xem", color: "bg-slate-500" },
};

const rolePermissions: Record<UserRole, string[]> = {
  admin: ["Xem giá", "Sửa watchlist", "Gửi Telegram", "Quản lý người dùng", "Cài đặt hệ thống"],
  manager: ["Xem giá", "Sửa watchlist", "Gửi Telegram", "Xem lịch biểu"],
  viewer: ["Xem giá", "Xem lịch biểu", "Xem tin tức"],
};

export function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("viewer");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/config/telegram", { cache: "no-store" });
      if (!res.ok) throw new Error("Không thể tải cấu hình");
      const data = await res.json();
      setUsers(data.users || []);
      if (data.current_user_id) {
        const cu = (data.users || []).find((u: User) => u.id === data.current_user_id);
        setCurrentUser(cu || null);
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

  const addUser = async () => {
    if (!newUserEmail || !newUserName) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    if (users.some(u => u.email === newUserEmail)) {
      setError("Email này đã tồn tại");
      return;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      email: newUserEmail,
      name: newUserName,
      role: newUserRole,
      created_at: new Date().toISOString(),
      is_active: true,
    };

    const updatedUsers = [...users, newUser];
    await saveUsers(updatedUsers);
    
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
    const updatedUsers = users.map(u => 
      u.id === id ? { ...u, role: newRole } : u
    );
    await saveUsers(updatedUsers);
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

  const canManageUsers = currentUser?.role === "admin" || currentUser?.role === "manager";
  const isAdmin = currentUser?.role === "admin";

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
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs text-white ${roleLabels[currentUser.role].color}`}>
              {roleLabels[currentUser.role].label}
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

      {/* Role Info */}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {Object.entries(roleLabels).map(([role, { label, color }]) => (
          <div key={role} className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${color}`}></span>
              <span className="font-medium text-slate-200 text-sm">{label}</span>
            </div>
            <ul className="text-xs text-slate-500 space-y-1">
              {rolePermissions[role as UserRole].map((perm, i) => (
                <li key={i}>• {perm}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

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
          <h3 className="font-medium text-slate-200 mb-3">Thêm người dùng mới</h3>
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
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as UserRole)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="viewer">Người xem</option>
              <option value="manager">Quản lý</option>
              {isAdmin && <option value="admin">Quản trị viên</option>}
            </select>
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
                      {canManageUsers ? (
                        <select
                          value={user.role}
                          onChange={(e) => changeUserRole(user.id, e.target.value as UserRole)}
                          disabled={user.id === currentUser?.id && user.role === "admin"}
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="viewer">Người xem</option>
                          <option value="manager">Quản lý</option>
                          {isAdmin && <option value="admin">Quản trị viên</option>}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs text-white ${roleLabels[user.role].color}`}>
                          {roleLabels[user.role].label}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        disabled={!canManageUsers || user.id === currentUser?.id}
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
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            user.id === currentUser?.id
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                          }`}
                        >
                          {user.id === currentUser?.id ? "✓ Đang dùng" : "Chuyển"}
                        </button>
                        {canManageUsers && user.id !== currentUser?.id && (
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="px-2 py-1 rounded text-xs bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 transition-colors"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
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
