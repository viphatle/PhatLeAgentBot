import { NextResponse } from "next/server";
import { getJsonValue } from "@/lib/kv";
import type { FileItem } from "../route";

const FILES_KEY = "user_files";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const files = await getJsonValue<FileItem[]>(FILES_KEY) || [];
    const file = files.find(f => f.id === params.id);
    
    if (!file) {
      return NextResponse.json(
        { error: "Tệp tin không tồn tại" },
        { status: 404 }
      );
    }

    return NextResponse.json({ file }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể lấy tệp tin" },
      { status: 500 }
    );
  }
}
