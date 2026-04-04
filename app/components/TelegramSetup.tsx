"use client";

import { useEffect, useState } from "react";

function reportErrorMessage(reason: string | undefined): string {
  switch (reason) {
    case "missing_token":
      return "Chưa lưu được Bot token — dán token, nhấn «Lưu cấu hình» (hoặc dùng «Gửi báo cáo thử» để tự lưu trước khi gửi).";
    case "missing_chat_id":
      return "Thiếu Chat ID — bắt buộc kèm token. Nhắn /start cho bot, mở getUpdates và copy số \"chat\":{\"id\": …} (nhóm thường là số âm).";
    case "missing_token_and_chat":
      return "Cần cả Bot token và Chat ID. Điền đủ hai ô rồi «Lưu cấu hình» hoặc bấm «Gửi báo cáo thử».";
    case "empty_watchlist":
      return "Chưa có mã cổ phiếu — thêm ít nhất một mã ở danh sách phía trên.";
    case "outside_session":
      return "Cron: ngoài phiên giao dịch (chỉ áp dụng gửi tự động).";
    case "no_price_data":
      return "Không lấy được giá thị trường gần nhất cho các mã trong danh sách.";
    default:
      return reason ? `Không gửi được: ${reason}` : "Gửi thất bại (kiểm tra token, Chat ID, ADMIN_SECRET).";
  }
}

export function TelegramSetup({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const [chatId, setChatId] = useState("");
  const [mock, setMock] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const a = localStorage.getItem("st_admin_secret") ?? "";
    setAdminSecret(a);
  }, []);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/config/telegram");
      if (!r.ok) return;
      const j = (await r.json()) as {
        telegram_chat_id: string;
        mock_prices: boolean;
        has_telegram_token: boolean;
      };
      setChatId(j.telegram_chat_id ?? "");
      setMock(Boolean(j.mock_prices));
      setHasToken(Boolean(j.has_telegram_token));
    })();
  }, []);

  return (
    <section className="rounded-2xl p-5 glass-card md:p-6">
      <h2 className="text-lg font-bold tracking-wide text-white">Telegram &amp; báo cáo</h2>
      <p className="mt-3 rounded-lg border border-line/80 bg-surface/40 px-3 py-2 text-xs text-slate-300">
        Cần đủ <strong className="text-slate-300">Bot token</strong> và{" "}
        <strong className="text-slate-300">Chat ID</strong>. Nút «Gửi báo cáo thử» sẽ{" "}
        <strong className="text-slate-300">lưu giá trị đang nhập</strong> (token + chat) rồi mới gửi.
      </p>
      <form
        className="mt-4 grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          const body: Record<string, unknown> = {
            telegram_chat_id: chatId.trim(),
            mock_prices: mock,
          };
          if (tokenInput.trim()) body.telegram_bot_token = tokenInput.trim();
          const r = await fetch("/api/config/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) {
            setMsg(j?.error ?? "Lưu thất bại");
            return;
          }
          setTokenInput("");
          setHasToken(Boolean(j.has_telegram_token));
          localStorage.setItem("st_admin_secret", adminSecret.trim());
          setMsg("Đã lưu cấu hình.");
          onSaved?.();
        }}
      >
        <label className="grid gap-1 text-sm text-muted">
          Bot token (từ @BotFather)
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={hasToken ? "Đã lưu — nhập mới để thay" : "Dán token"}
            className="neo-input rounded-lg px-3 py-2 text-slate-100 outline-none"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Chat ID
          <input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Số chat cá nhân hoặc nhóm"
            className="neo-input rounded-lg px-3 py-2 text-slate-100 outline-none"
            autoComplete="off"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={mock}
            onChange={(e) => setMock(e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
          Dùng giá giả lập (MOCK)
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Admin secret (chỉ trình duyệt — dùng cho nút &quot;Gửi báo cáo&quot; khi có{" "}
          <code className="text-slate-400">ADMIN_SECRET</code> trên Vercel)
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="Để trống nếu chưa bật ADMIN_SECRET"
            className="neo-input rounded-lg px-3 py-2 text-slate-100 outline-none"
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="brand-btn rounded-lg px-4 py-2 text-sm font-semibold text-white"
          >
            Lưu cấu hình
          </button>
          <button
            type="button"
            className="rounded-lg subtle-btn px-4 py-2 text-sm text-slate-200"
            onClick={async () => {
              setMsg(null);
              const saveBody: Record<string, unknown> = {
                telegram_chat_id: chatId.trim(),
                mock_prices: mock,
              };
              if (tokenInput.trim()) {
                saveBody.telegram_bot_token = tokenInput.trim();
              }
              const save = await fetch("/api/config/telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(saveBody),
              });
              const saveJson = await save.json().catch(() => ({}));
              if (!save.ok) {
                setMsg(saveJson?.error ?? "Không lưu được cấu hình trước khi gửi.");
                return;
              }
              if (tokenInput.trim()) {
                setTokenInput("");
              }
              setHasToken(Boolean(saveJson.has_telegram_token));
              setChatId(String(saveJson.telegram_chat_id ?? chatId));

              const headers: Record<string, string> = {};
              const sec = adminSecret.trim();
              if (sec) headers.Authorization = `Bearer ${sec}`;
              const r = await fetch("/api/report", { method: "POST", headers });
              const j = (await r.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
              if (!r.ok || !j.ok) {
                setMsg(reportErrorMessage(j.reason));
                return;
              }
              setMsg("Đã gửi báo cáo qua Telegram.");
            }}
          >
            Gửi báo cáo thử
          </button>
        </div>
      </form>
      {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
      <p className="mt-4 text-xs text-muted">
        Lấy Chat ID: nhắn <code className="rounded bg-surface px-1">/start</code> cho bot, mở{" "}
        <code className="rounded bg-surface px-1 break-all">
          https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
        </code>
      </p>
    </section>
  );
}
