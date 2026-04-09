import { NextResponse } from "next/server";
import { getJsonValue, setJsonValue } from "@/lib/kv";

export const dynamic = "force-dynamic";

const FILES_KEY = "user_files";

export type FileItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // base64
  uploadedAt: string;
  category?: string;
};

// GET - List all files
export async function GET() {
  try {
    const files = await getJsonValue<FileItem[]>(FILES_KEY) || [];
    return NextResponse.json({ files }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể lấy danh sách tệp tin" },
      { status: 500 }
    );
  }
}

// POST - Upload new file
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string || "Tài liệu";

    if (!file) {
      return NextResponse.json(
        { error: "Không có tệp tin được chọn" },
        { status: 400 }
      );
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Tệp tin quá lớn (tối đa 5MB)" },
        { status: 400 }
      );
    }

    // Read file as base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const newFile: FileItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      content: base64,
      uploadedAt: new Date().toISOString(),
      category,
    };

    // Get existing files and add new one
    const existingFiles = await getJsonValue<FileItem[]>(FILES_KEY) || [];
    const updatedFiles = [newFile, ...existingFiles];

    // Limit to 50 files to prevent storage overflow
    if (updatedFiles.length > 50) {
      updatedFiles.splice(50);
    }

    await setJsonValue(FILES_KEY, updatedFiles);

    return NextResponse.json({ 
      success: true, 
      file: {
        id: newFile.id,
        name: newFile.name,
        size: newFile.size,
        type: newFile.type,
        uploadedAt: newFile.uploadedAt,
        category: newFile.category,
      }
    });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Không thể tải lên tệp tin" },
      { status: 500 }
    );
  }
}

// DELETE - Remove file
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json(
        { error: "Thiếu ID tệp tin" },
        { status: 400 }
      );
    }

    const files = await getJsonValue<FileItem[]>(FILES_KEY) || [];
    const updatedFiles = files.filter((f: FileItem) => f.id !== id);
    
    await setJsonValue(FILES_KEY, updatedFiles);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể xóa tệp tin" },
      { status: 500 }
    );
  }
}
