"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState("/");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setNext(sp.get("next") || "/");
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl p-6 glass-card">
        <h1 className="text-2xl font-black tracking-tight text-white">Đăng Nhập</h1>
        <p className="mt-2 text-sm text-slate-300">
          Đăng nhập để sử dụng trang web cá nhân, hoặc đăng ký tài khoản mới.
        </p>

        <form
          className="mt-5 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            if (mode === "register" && password !== confirmPassword) {
              setMsg("Mật khẩu xác nhận không khớp.");
              return;
            }
            setLoading(true);
            const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
            const r = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, id: username, password }),
            });
            const j = await r.json().catch(() => ({}));
            setLoading(false);
            if (!r.ok) {
              setMsg(j?.error ?? "Đăng nhập thất bại.");
              return;
            }
            window.location.href = next;
          }}
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tài khoản"
            className="neo-input rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
            autoComplete="username"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            className="neo-input rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
            autoComplete="current-password"
            required
          />
          {mode === "register" && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              className="neo-input rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
              autoComplete="new-password"
              required
            />
          )}
          <button
            type="submit"
            className="brand-btn rounded-lg px-4 py-2 text-sm font-semibold text-white"
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            onClick={() => {
              setMsg(null);
              setPassword("");
              setConfirmPassword("");
              setMode((m) => (m === "login" ? "register" : "login"));
            }}
          >
            {mode === "login" ? "Tạo tài khoản mới" : "Quay lại đăng nhập"}
          </button>
        </form>

        {msg && (
          <p className={`mt-3 text-sm ${msg.includes("thành công") ? "text-up" : "text-down"}`}>{msg}</p>
        )}
      </section>
    </main>
  );
}
