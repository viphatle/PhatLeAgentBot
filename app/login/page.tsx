"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        <p className="mt-2 text-sm text-slate-300">Đăng nhập để sử dụng trang web cá nhân.</p>

        <form
          className="mt-5 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            setLoading(true);
            const r = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, password }),
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
          <button
            type="submit"
            className="brand-btn rounded-lg px-4 py-2 text-sm font-semibold text-white"
            disabled={loading}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm text-down">{msg}</p>}
      </section>
    </main>
  );
}
