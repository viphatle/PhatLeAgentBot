import { getScheduleNotes, KvRequiredError, setScheduleNotes } from "@/lib/kv";

export const dynamic = "force-dynamic";

function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isIsoMonth(v: string) {
  return /^\d{4}-\d{2}$/.test(v);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month")?.trim();
    const notes = await getScheduleNotes();
    if (!month) return Response.json({ notes });
    if (!isIsoMonth(month)) {
      return Response.json({ error: "month không hợp lệ (YYYY-MM)" }, { status: 400 });
    }
    const filtered = Object.fromEntries(
      Object.entries(notes).filter(([date]) => date.startsWith(`${month}-`)),
    );
    return Response.json({ notes: filtered });
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { date?: string; note?: string };
    const date = body.date?.trim() ?? "";
    const note = body.note?.trim() ?? "";
    if (!isIsoDate(date)) {
      return Response.json({ error: "date không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
    }
    const notes = await getScheduleNotes();
    if (!note) {
      delete notes[date];
    } else {
      notes[date] = note.slice(0, 1000);
    }
    await setScheduleNotes(notes);
    return Response.json({ ok: true, notes });
  } catch (e) {
    if (e instanceof KvRequiredError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}
