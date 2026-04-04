import { getScheduleEvents, KvRequiredError, setScheduleEvents } from "@/lib/kv";
import { sendScheduleCreatedNotice } from "@/lib/schedule-reminders";
import type { ScheduleEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isIsoMonth(v: string) {
  return /^\d{4}-\d{2}$/.test(v);
}

function isHourMinute(v: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month")?.trim();
    const events = await getScheduleEvents();
    if (!month) return Response.json({ events });
    if (!isIsoMonth(month)) {
      return Response.json({ error: "month không hợp lệ (YYYY-MM)" }, { status: 400 });
    }
    const filtered = events.filter((e) => e.date.startsWith(`${month}-`));
    return Response.json({ events: filtered });
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { date?: string; time?: string; note?: string };
    const date = body.date?.trim() ?? "";
    const time = body.time?.trim() ?? "";
    const note = body.note?.trim() ?? "";
    if (!isIsoDate(date)) {
      return Response.json({ error: "date không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!isHourMinute(time)) {
      return Response.json({ error: "time không hợp lệ (HH:mm)" }, { status: 400 });
    }
    if (!note) {
      return Response.json({ error: "Thiếu nội dung ghi chú" }, { status: 400 });
    }

    const events = await getScheduleEvents();
    const event: ScheduleEvent = {
      id: crypto.randomUUID(),
      date,
      time,
      note: note.slice(0, 1000),
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
    const events = await getScheduleEvents();
    const next = events.filter((e) => e.id !== id);
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
