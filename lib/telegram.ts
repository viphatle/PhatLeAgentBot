function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DigestRow = {
  symbol: string;
  display_name?: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  buy_price?: number;
  pnl_value?: number;
  pnl_pct?: number;
  source?: string;
};

function trendVisual(change: number) {
  if (change > 0) return { dot: "🟢", arrow: "📈", sign: "+" };
  if (change < 0) return { dot: "🔴", arrow: "📉", sign: "" };
  return { dot: "🟡", arrow: "➖", sign: "" };
}

function pnlVisual(pnlPct?: number) {
  if (pnlPct === undefined || !Number.isFinite(pnlPct)) return { label: "Chưa có", icon: "⚪", sign: "" };
  if (pnlPct > 0) return { label: "Lãi", icon: "🟢", sign: "+" };
  if (pnlPct < 0) return { label: "Lỗ", icon: "🔴", sign: "" };
  return { label: "Hòa vốn", icon: "🟡", sign: "" };
}

export function formatDigest(rows: DigestRow[], sessionLabel: string, timeLabel: string) {
  const lines = [
    `📊 <b>DANH SÁCH CHỨNG KHOÁN</b>`,
    `🏷️ Phiên: <b>${escapeHtml(sessionLabel)}</b>`,
    "",
  ];
  let anyDemo = false;
  let anyFallback = false;
  for (const row of rows) {
    const sym = escapeHtml(row.symbol);
    const name = escapeHtml(row.display_name || row.symbol);
    const visual = trendVisual(row.change);
    if (row.source === "mock_demo") anyDemo = true;
    if (row.source === "mock_fallback") anyFallback = true;
    lines.push(`${visual.dot} <b>${sym}</b> - ${name}`);
    lines.push(
      `   ${visual.arrow} Giá TT: <code>${row.price.toLocaleString("vi-VN")}</code> | KL: <b>${row.volume.toLocaleString("vi-VN")}</b>`,
    );
    lines.push(
      `   Δ thị trường: <b>${visual.sign}${row.change.toLocaleString("vi-VN")} (${visual.sign}${row.change_pct.toFixed(2)}%)</b>`,
    );
    if (row.buy_price !== undefined && Number.isFinite(row.buy_price)) {
      const pnl = pnlVisual(row.pnl_pct);
      lines.push(`   💰 Giá mua: <code>${row.buy_price.toLocaleString("vi-VN")}</code>`);
      if (row.pnl_value !== undefined && row.pnl_pct !== undefined) {
        lines.push(
          `   ${pnl.icon} ${pnl.label}: <b>${pnl.sign}${row.pnl_value.toLocaleString("vi-VN")} (${pnl.sign}${row.pnl_pct.toFixed(2)}%)</b>`,
        );
      }
    }
    lines.push("");
  }
  if (anyDemo) {
    lines.push("", "<i>Giá giả lập: bạn đang bật «Dùng giá giả lập» trong cài đặt.</i>");
  }
  if (anyFallback) {
    lines.push(
      "",
      "<i>Một số giá là số thử nghiệm: Yahoo/VNDIRECT/TCBS đều không lấy được dữ liệu cho mã đó (mã HNX/UPCOM có thể không có trên Yahoo .VN).</i>"
    );
  }
  lines.push("", `🕐 Cập nhật: ${escapeHtml(timeLabel)}`);
  return lines.join("\n");
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Telegram: ${r.status} ${err}`);
  }
}
