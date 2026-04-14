import { getScheduleEvents, KvRequiredError, setScheduleEvents } from "@/lib/kv";
import { sendScheduleCreatedNotice } from "@/lib/schedule-reminders";
import type { ScheduleEvent } from "@/lib/types";
import { verifySessionToken } from "@/lib/session";
import { authSecret } from "@/lib/auth";
import {
  expandEventsByMonth,
  isHourMinute,
  isIsoDate,
  isIsoMonth,
  seriesIdFromOccurrenceId,
} from "@/lib/schedule-utils";

export const dynamic = "force-dynamic";

// Get current user from session
async function getCurrentUserFromRequest(req: Request): Promise<{ uid: string; role: string } | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/st_session=([^;]+)/);
  if (!sessionMatch) return null;
  
  const token = sessionMatch[1];
  const session = await verifySessionToken(token, authSecret());
  if (!session) return null;
  
  return { uid: session.uid, role: session.role };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month")?.trim();
    const events = await getScheduleEvents();
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!month) return Response.json({ events, currentUser: currentUser?.uid ?? null });
    if (!isIsoMonth(month)) {
      return Response.json({ error: "month không hợp lệ (YYYY-MM)" }, { status: 400 });
    }
    const expanded = expandEventsByMonth(events, month);
    // Add visibility and created_by to expanded events from parent event
    const eventsWithMeta = expanded.map(occ => {
      const parentEvent = events.find(e => e.id === occ.series_id);
      return {
        ...occ,
        visibility: parentEvent?.visibility ?? "private",
        created_by: parentEvent?.created_by,
      };
    });
    return Response.json({ events: eventsWithMeta, currentUser: currentUser?.uid ?? null });
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    const body = (await req.json()) as {
      date?: string;
      time?: string;
      note?: string;
      visibility?: "public" | "private";
      recurrence?: {
        mode?: "none" | "weekly" | "monthly";
        weekdays?: number[];
        month_day?: number;
      };
    };
    const date = body.date?.trim() ?? "";
    const time = body.time?.trim() ?? "";
    const note = body.note?.trim() ?? "";
    const visibility = body.visibility ?? "private";
    
    if (!isIsoDate(date)) {
      return Response.json({ error: "date không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!isHourMinute(time)) {
      return Response.json({ error: "time không hợp lệ (HH:mm)" }, { status: 400 });
    }
    if (!note) {
      return Response.json({ error: "Thiếu nội dung ghi chú" }, { status: 400 });
    }
    const mode = body.recurrence?.mode ?? "none";
    if (!["none", "weekly", "monthly"].includes(mode)) {
      return Response.json({ error: "Chế độ lặp không hợp lệ" }, { status: 400 });
    }
    let recurrence: ScheduleEvent["recurrence"] = { mode };
    if (mode === "weekly") {
      const weekdays = (body.recurrence?.weekdays ?? [])
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
      if (!weekdays.length) {
        return Response.json({ error: "Chọn ít nhất 1 thứ trong tuần" }, { status: 400 });
      }
      const uniqueWeekdays = weekdays.filter((v, i, arr) => arr.indexOf(v) === i);
      recurrence = { mode, weekdays: uniqueWeekdays };
    }
    if (mode === "monthly") {
      const md = Number(body.recurrence?.month_day);
      if (!Number.isInteger(md) || md < 1 || md > 31) {
        return Response.json({ error: "Ngày lặp tháng không hợp lệ (1-31)" }, { status: 400 });
      }
      recurrence = { mode, month_day: md };
    }

    const events = await getScheduleEvents();
    const event: ScheduleEvent = {
      id: crypto.randomUUID(),
      date,
      time,
      note: note.slice(0, 1000),
      recurrence,
      visibility,
      created_by: currentUser?.uid ?? "anonymous",
      created_at: new Date().toISOString(),
    };
    const next = [...events, event].sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
    );
    await setScheduleEvents(next);
    void sendScheduleCreatedNotice(event).catch(() => {});
    return Response.json({ ok: true, event, events: next });
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = body.id?.trim() ?? "";
    if (!id) return Response.json({ error: "Thiếu id sự kiện" }, { status: 400 });
    const seriesId = seriesIdFromOccurrenceId(id);
    const events = await getScheduleEvents();
    const next = events.filter((e) => e.id !== seriesId);
    if (next.length === events.length) {
      return Response.json({ error: "Không tìm thấy sự kiện" }, { status: 404 });
    }
    await setScheduleEvents(next);
    return Response.json({ ok: true, events: next });
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}
