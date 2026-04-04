"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="rounded-lg subtle-btn px-3 py-1.5 text-sm text-slate-100"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      Đăng xuất
    </button>
  );
}
