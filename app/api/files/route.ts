import { NextResponse } from "next/server";
import { getJsonValue, setJsonValue } from "@/lib/kv";
import { encryptFileContent, decryptFileContent, verifyFileAccess, checkFilePermission } from "@/lib/file-security";

export const dynamic = "force-dynamic";

const FILES_KEY = "user_files";

export type FileItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  encrypted: string; // encrypted content
  iv: string; // initialization vector
  authTag: string; // GCM auth tag
  uploadedAt: string;
  category?: string;
  uploadedBy: string; // user ID who uploaded
  uploadSessionId?: string; // for extra security tracking
};

// GET - List all files (requires authentication)
export async function GET() {
  try {
    // Verify authentication
    const session = await verifyFileAccess();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem tệp tin" },
        { status: 401 }
      );
    }

    const allFiles = await getJsonValue<FileItem[]>(FILES_KEY) || [];
    
    // Filter: show only files uploaded by this user or all if admin
    const isAdmin = session.role === "admin" || session.role === "super_admin";
    const visibleFiles = isAdmin 
      ? allFiles 
      : allFiles.filter(f => f.uploadedBy === session.uid || f.uploadSessionId === session.uid);
    
    // Return file metadata only (no content)
    const fileList = visibleFiles.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedAt: f.uploadedAt,
      category: f.category,
      uploadedBy: f.uploadedBy,
    }));
    
    return NextResponse.json({ files: fileList }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("File list error:", error);
    return NextResponse.json(
      { error: "Không thể lấy danh sách tệp tin" },
      { status: 500 }
    );
  }
}

// POST - Upload new file (requires authentication, encrypted storage)
export async function POST(req: Request) {
  try {
    // Verify authentication
    const session = await verifyFileAccess();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để tải lên tệp tin" },
        { status: 401 }
      );
    }

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

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Encrypt file content
    const { encrypted, iv, authTag } = encryptFileContent(buffer);

    const newFile: FileItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      encrypted,
      iv,
      authTag,
      uploadedAt: new Date().toISOString(),
      category,
      uploadedBy: session.uid,
      uploadSessionId: session.uid,
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
        uploadedBy: session.uid,
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

// DELETE - Remove file (requires ownership or admin)
export async function DELETE(req: Request) {
  try {
    // Verify authentication
    const session = await verifyFileAccess();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập" },
        { status: 401 }
      );
    }

    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json(
        { error: "Thiếu ID tệp tin" },
        { status: 400 }
      );
    }

    const files = await getJsonValue<FileItem[]>(FILES_KEY) || [];
    const fileToDelete = files.find((f: FileItem) => f.id === id);
    
    if (!fileToDelete) {
      return NextResponse.json(
        { error: "Tệp tin không tồn tại" },
        { status: 404 }
      );
    }

    // Check permission: owner or admin can delete
    const isAdmin = session.role === "admin" || session.role === "super_admin";
    const isOwner = fileToDelete.uploadedBy === session.uid || fileToDelete.uploadSessionId === session.uid;
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa tệp tin này" },
        { status: 403 }
      );
    }

    const updatedFiles = files.filter((f: FileItem) => f.id !== id);
    await setJsonValue(FILES_KEY, updatedFiles);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("File delete error:", error);
    return NextResponse.json(
      { error: "Không thể xóa tệp tin" },
      { status: 500 }
    );
  }
}
