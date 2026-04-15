# Hướng dẫn Migration từ Redis sang Supabase

## 📋 Bước 1: Chuẩn bị Supabase

1. **Tạo project trên Supabase** (hoặc dùng project có sẵn)
2. **Lấy credentials**:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL của project (ví dụ: `https://xxxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Vào Project Settings → API → Service Role Key

3. **Tạo bảng**:
   - Mở SQL Editor trong Supabase Dashboard
   - Copy nội dung từ file `supabase-schema.sql` và chạy

## 🔧 Bước 2: Cập nhật Environment Variables

Thêm vào `.env` hoặc Vercel Dashboard:

```env
# Supabase (bắt buộc)
NEXT_PUBLIC_SUPABASE_URL=https://bcuccnesgdgvphhcfaqg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Giữ lại Redis tạm thời để migration
REDIS_URL=...

# Các biến khác giữ nguyên
AUTH_SECRET=...
CRON_SECRET=...
```

## 🚚 Bước 3: Chạy Migration

```bash
# 1. Cài ts-node nếu chưa có
npm install -g ts-node

# 2. Chạy migration
npx ts-node scripts/migrate-to-supabase.ts
```

Script sẽ tự động chuyển:
- ✅ Users (tài khoản)
- ✅ Watchlist (danh sách theo dõi)
- ✅ Settings (cài đặt Telegram)
- ✅ Schedule Events (lịch biểu)

## 🔄 Bước 4: Cập nhật Code

Thay thế các import trong code:

### File: `lib/kv.ts` (hoặc tạo file mới)
```typescript
// Cách 1: Thay thế hoàn toàn
export * from './supabase';

// Cách 2: Rename file
// mv lib/kv.ts lib/kv-redis-backup.ts
// mv lib/supabase.ts lib/kv.ts
```

### File: `lib/auth.ts` (hoặc tạo file mới)
```typescript
// Cách 1: Thay thế hoàn toàn
export * from './supabase-auth';

// Cách 2: Rename file
// mv lib/auth.ts lib/auth-redis-backup.ts
// mv lib/supabase-auth.ts lib/auth.ts
```

### Cập nhật các file API

Tìm và thay thế các import:
- `from "@/lib/kv"` → `from "@/lib/supabase"` (hoặc giữ nguyên nếu đã rename)
- `from "@/lib/auth"` → `from "@/lib/supabase-auth"` (hoặc giữ nguyên nếu đã rename)

Các file cần cập nhật:
- `app/api/auth/login/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/config/telegram/route.ts`
- `app/api/cron/report/route.ts`
- `app/api/cron/schedule-reminders/route.ts`
- `app/api/files/route.ts`
- `app/api/report/route.ts`
- `app/api/schedule/route.ts`
- `app/api/stocks/route.ts`
- `app/api/stocks/[ticker]/history/route.ts`

## 🧪 Bước 5: Test

```bash
npm run build
npm run dev
```

Kiểm tra các chức năng:
1. Đăng nhập/đăng xuất
2. Watchlist (thêm/xóa mã)
3. Cài đặt Telegram
4. Lịch biểu (thêm/xóa sự kiện)
5. Gửi báo cáo

## 🗑️ Bước 6: Xóa Redis (sau khi chắc chắn)

Khi mọi thứ hoạt động ổn định:

1. Xóa `REDIS_URL` khỏi Vercel Dashboard
2. Xóa Vercel Redis (nếu dùng)
3. Xóa backup files: `lib/kv-redis-backup.ts`, `lib/auth-redis-backup.ts`

## 🆘 Khắc phục sự cố

### Lỗi: "relation does not exist"
→ Chưa chạy schema SQL. Vào Supabase SQL Editor và chạy `supabase-schema.sql`

### Lỗi: "invalid input syntax"
→ Kiểm tra kiểu dữ liệu trong schema và migration script

### Mất dữ liệu sau migration
→ Redis vẫn còn dữ liệu gốc, chạy lại migration script

### Supabase free tier limits
- 500MB storage (đủ cho app này)
- 100K requests/day
- Max 1,000 rows/table (nếu vượt quá, cần xóa dữ liệu cũ)

## 📊 So sánh Redis vs Supabase

| Feature | Redis | Supabase |
|---------|-------|----------|
| Giá Free | 256MB | 500MB |
| Query | Key-value | SQL + Filters |
| Backup | Manual | Auto |
| GUI | CLI | Dashboard |
| Relations | Không | Có |

## ✅ Checklist

- [ ] Tạo project Supabase
- [ ] Chạy schema SQL
- [ ] Thêm env variables
- [ ] Chạy migration script
- [ ] Cập nhật imports
- [ ] Test toàn bộ chức năng
- [ ] Xóa Redis (sau 1 tuần ổn định)
