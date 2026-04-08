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

// Compact trend indicator
function trendArrow(change: number): string {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "▬";
}

function trendEmoji(change: number): string {
  if (change > 0) return "📈";
  if (change < 0) return "📉";
  return "➖";
}

// Compact number formatter (K/M/B)
function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("vi-VN");
}

// PnL status emoji
function pnlEmoji(pnlPct?: number): string {
  if (pnlPct === undefined || !Number.isFinite(pnlPct)) return "⚪";
  if (pnlPct > 5) return "🟢";
  if (pnlPct > 0) return "🍀";
  if (pnlPct > -5) return "🟡";
  return "🔴";
}

// Professional compact digest format
export function formatDigest(rows: DigestRow[], sessionLabel: string, timeLabel: string) {
  const lines: string[] = [];
  
  // Header with session info
  lines.push(`<b>📊 STOCK WATCH | ${escapeHtml(sessionLabel)}</b>`);
  lines.push("─".repeat(35));
  
  let anyDemo = false;
  let totalPnl = 0;
  let hasPnl = false;
  
  // Compact stock rows
  for (const row of rows) {
    const sym = escapeHtml(row.symbol);
    const arrow = trendArrow(row.change);
    const emoji = trendEmoji(row.change);
    const sign = row.change >= 0 ? "+" : "";
    
    if (row.source === "mock_demo") anyDemo = true;
    
    // Main line: Symbol | Price | Change% | Volume
    const priceStr = row.price.toLocaleString("vi-VN");
    const changeStr = `${sign}${row.change_pct.toFixed(1)}%`;
    const volStr = compactNumber(row.volume);
    
    lines.push(`${emoji} <b>${sym}</b> ${priceStr} ${arrow} ${changeStr} | ${volStr}`);
    
    // Optional PnL line (compact)
    if (row.buy_price !== undefined && Number.isFinite(row.buy_price) && row.pnl_pct !== undefined) {
      hasPnl = true;
      totalPnl += row.pnl_value || 0;
      const pnlIcon = pnlEmoji(row.pnl_pct);
      const pnlSign = row.pnl_pct >= 0 ? "+" : "";
      lines.push(`   ${pnlIcon} ${row.buy_price.toLocaleString("vi-VN")} → ${pnlSign}${row.pnl_pct.toFixed(1)}%`);
    }
  }
  
  // Summary line if has PnL
  if (hasPnl && rows.length > 1) {
    const totalSign = totalPnl >= 0 ? "+" : "";
    const totalIcon = totalPnl >= 0 ? "📈" : "📉";
    lines.push("");
    lines.push(`${totalIcon} <b>TỔNG P/L: ${totalSign}${totalPnl.toLocaleString("vi-VN")}</b>`);
  }
  
  // Footer
  lines.push("");
  if (anyDemo) {
    lines.push("<i>⚠️ Giá giả lập đang bật</i>");
  }
  lines.push(`<code>${escapeHtml(timeLabel)}</code>`);
  
  return lines.join("\n");
}

// Schedule notification format (compact)
export function formatScheduleAlert(date: string, time: string, note: string, recurrence?: string) {
  const lines: string[] = [];
  lines.push(`<b>⏰ SCHEDULE ALERT</b>`);
  lines.push("─".repeat(25));
  lines.push(`📅 ${date} ⏱️ ${time}`);
  if (recurrence) {
    lines.push(`🔄 ${recurrence}`);
  }
  lines.push("");
  lines.push(`<b>${escapeHtml(note)}</b>`);
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
