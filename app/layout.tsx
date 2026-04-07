import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Monitor VN — Professional Stock Tracker",
  description: "Theo dõi giá cổ phiếu Việt Nam thời gian thực. Phân tích kỹ thuật, dự báo đa kịch bản, tin tức doanh nghiệp. Tích hợp Telegram notifications.",
  keywords: ["cổ phiếu Việt Nam", "VN30", "HOSE", "HNX", "theo dõi giá", "phân tích kỹ thuật", "dự báo cổ phiếu"],
  authors: [{ name: "Stock Monitor VN" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Stock Monitor VN",
    description: "Theo dõi giá cổ phiếu Việt Nam thời gian thực với phân tích kỹ thuật và dự báo",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
