"use client";

import { useState } from "react";

export default function InitDbPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function initDatabase() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/init-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to initialize");
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">🗄️ Khởi tạo Database</h1>
        <p className="text-slate-400 mb-6">
          Trang này sẽ tạo các bảng cần thiết trong Supabase để ứng dụng hoạt động.
        </p>

        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Các bảng sẽ được tạo:</h2>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>users - Quản lý tài khoản</li>
            <li>watchlist - Danh sách cổ phiếu theo dõi</li>
            <li>app_settings - Cài đặt ứng dụng</li>
            <li>schedule_events - Lịch sự kiện</li>
            <li>pnl_alerts - Cảnh báo PNL</li>
            <li>forecasts - Dự báo giá</li>
            <li>forecast_history - Lịch sử dự báo</li>
            <li>forecast_accuracy - Thống kê độ chính xác</li>
          </ul>
        </div>

        <button
          onClick={initDatabase}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-semibold ${
            loading
              ? "bg-slate-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "⏳ Đang khởi tạo..." : "🚀 Khởi tạo Database"}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-400">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg">
            <h3 className="font-semibold text-emerald-400 mb-2">✅ Kết quả:</h3>
            <p className="text-slate-300">
              Bảng tạo thành công: {result.tables_created || 0}
            </p>
            <p className="text-slate-300">
              Bảng thất bại: {result.tables_failed || 0}
            </p>
            {result.tables_failed > 0 && (
              <p className="text-amber-400 mt-2 text-sm">
                ⚠️ Một số bảng có thể đã tồn tại hoặc có lỗi. Bạn có thể thử reload trang.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 text-sm text-slate-500">
          <p>Nếu tính năng này không hoạt động, bạn có thể:</p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Vào <a href="https://app.supabase.io" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Supabase Dashboard</a></li>
            <li>Chọn project → SQL Editor</li>
            <li>Copy nội dung từ file <code className="bg-slate-800 px-1 rounded">supabase-schema.sql</code></li>
            <li>Chạy SQL để tạo bảng thủ công</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
