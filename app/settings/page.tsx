import { LogoutButton } from "../components/LogoutButton";
import { TelegramSetup } from "../components/TelegramSetup";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <header className="mb-6 rounded-2xl p-5 glass-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">SETTING</h1>
          <div className="flex items-center gap-2">
            <a href="/" className="rounded-lg subtle-btn px-3 py-1.5 text-sm text-slate-100">
              Quay trở lại trang chủ
            </a>
            <a href="/schedule" className="rounded-lg subtle-btn px-3 py-1.5 text-sm text-slate-100">
              Mở lịch biểu
            </a>
            <LogoutButton />
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Cấu hình Telegram và gửi báo cáo thử được đặt riêng tại trang này.
        </p>
      </header>

      <TelegramSetup />
    </main>
  );
}
